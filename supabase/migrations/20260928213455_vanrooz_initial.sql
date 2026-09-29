-- Dedicated Vanrooz project only. No public write grants; published projection only.
create table public.editions(day date primary key, published_at timestamptz not null default now(), payload jsonb not null);
create table public.articles(id text primary key, edition_day date not null references public.editions(day), payload jsonb not null);
create table public.events(id text primary key, edition_day date not null references public.editions(day), payload jsonb not null);
create table public.sources(id text primary key, config jsonb not null, checked_at timestamptz);
create table public.runs(id text primary key, day date not null, state text not null check(state in ('running','failed','published')), started_at timestamptz default now(), finished_at timestamptz, error_code text, metrics jsonb not null default '{}');
create index runs_day_idx on public.runs(day,started_at desc);
create table public.job_lock(id integer primary key check(id=1), owner text, expires_at timestamptz);
insert into public.job_lock(id) values(1);
create table public.evidence(id text primary key, edition_day date, data jsonb not null);
create table public.processed(id text primary key, hash text not null, event_key text not null, published_day date not null, facts text not null);
create table public.ai_cache(key text primary key, response jsonb not null, created_at timestamptz default now());
create table public.usage_ledger(id text primary key, run_id text not null, day date not null, model text not null, reserved_usd numeric not null check(reserved_usd>0), actual_usd numeric, input_tokens integer, output_tokens integer, state text not null default 'reserved', created_at timestamptz default now());
create index usage_month_idx on public.usage_ledger(day);
create table public.budget_lock(id integer primary key check(id=1));
insert into public.budget_lock values(1);
create table public.image_assets(id text primary key, metadata jsonb not null);
create index articles_day_idx on public.articles(edition_day);
create index events_day_idx on public.events(edition_day);
DO $$ DECLARE t text; BEGIN
 foreach t in array array['editions','articles','events','sources','runs','job_lock','evidence','processed','ai_cache','usage_ledger','budget_lock','image_assets'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
END $$;
grant select on public.editions,public.articles,public.events to anon,authenticated;
create policy read_editions on public.editions for select to anon,authenticated using(true);
create policy read_articles on public.articles for select to anon,authenticated using(exists(select 1 from public.editions e where e.day=edition_day));
create policy read_events on public.events for select to anon,authenticated using(exists(select 1 from public.editions e where e.day=edition_day));

-- SECURITY INVOKER: only service_role gets execute and underlying table privileges.
create function public.claim_run(p_id text,p_day date) returns boolean language plpgsql security invoker set search_path='' as $$
declare l public.job_lock; begin
 select * into l from public.job_lock where id=1 for update;
 if exists(select 1 from public.editions where day=p_day) then return false; end if;
 if l.owner=p_id and l.expires_at>now() then return true; end if;
 if l.expires_at>now() then return false; end if;
 if l.owner is not null then update public.runs set state='failed',error_code='LOCK_EXPIRED',finished_at=now() where id=l.owner and state='running'; end if;
 update public.job_lock set owner=p_id,expires_at=now()+interval '90 minutes' where id=1;
 insert into public.runs(id,day,state) values(p_id,p_day,'running') on conflict(id) do update set state='running',error_code=null,finished_at=null;
 return true;
end $$;
create function public.reserve_usage(p_id text,p_run text,p_day date,p_model text,p_reserve numeric,p_daily numeric,p_monthly numeric) returns boolean language plpgsql security invoker set search_path='' as $$
declare m numeric; d numeric; begin
 perform 1 from public.budget_lock where id=1 for update;
 if p_reserve<=0 or p_daily<=0 or p_monthly<=0 or p_monthly>20 or p_daily>1 then raise exception 'BAD_BUDGET'; end if;
 if not exists(select 1 from public.job_lock where id=1 and owner=p_run and expires_at>now()) then raise exception 'LOCK_LOST'; end if;
 if exists(select 1 from public.usage_ledger where id=p_id) then return false; end if;
 select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into m from public.usage_ledger where day>=date_trunc('month',p_day)::date and day<(date_trunc('month',p_day)+interval '1 month')::date;
 select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into d from public.usage_ledger where day=p_day;
 if m+p_reserve>p_monthly or d+p_reserve>p_daily then return false; end if;
 insert into public.usage_ledger(id,run_id,day,model,reserved_usd) values(p_id,p_run,p_day,p_model,p_reserve);
 return true;
end $$;
create function public.publish_edition(p_run text,p_day date,p_payload jsonb,p_evidence jsonb,p_processed jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare x jsonb; begin
 perform 1 from public.job_lock where id=1 for update;
 if exists(select 1 from public.editions where day=p_day) then return false; end if;
 if not exists(select 1 from public.job_lock where id=1 and owner=p_run and expires_at>now()) then raise exception 'LOCK_LOST'; end if;
 if p_payload->>'date'<>p_day::text or jsonb_typeof(p_payload->'articles')<>'array' or jsonb_array_length(p_payload->'articles')<1 or jsonb_array_length(p_payload->'articles')>13 or jsonb_typeof(p_payload->'events')<>'array' or jsonb_array_length(p_payload->'events')>6 then raise exception 'INVALID_EDITION'; end if;
 insert into public.editions(day,payload) values(p_day,p_payload);
 for x in select * from jsonb_array_elements(p_payload->'articles') loop
 if length(x->>'headline')<8 or length(x->>'intro')<30 or jsonb_array_length(x->'paragraphs')<1 or x->'image'->>'url' is null then raise exception 'INVALID_ARTICLE'; end if;
 insert into public.articles values(x->>'id',p_day,x);
 end loop;
 for x in select * from jsonb_array_elements(p_payload->'events') loop
 if jsonb_array_length(x->'occurrences')<1 or x->>'bookingUrl' is null then raise exception 'INVALID_EVENT'; end if;
 insert into public.events values(x->>'id',p_day,x);
 end loop;
 insert into public.evidence(id,edition_day,data) values(p_run,p_day,p_evidence);
 for x in select * from jsonb_array_elements(p_processed) loop
 insert into public.processed values(x->>'id',x->>'hash',x->>'event_key',p_day,x->>'facts') on conflict(id) do update set hash=excluded.hash,event_key=excluded.event_key,published_day=excluded.published_day,facts=excluded.facts;
 end loop;
 update public.runs set state='published',finished_at=now() where id=p_run;
 update public.job_lock set owner=null,expires_at=null where id=1 and owner=p_run;
 return true;
end $$;
create function public.fail_run(p_run text,p_code text) returns void language plpgsql security invoker set search_path='' as $$ begin
 update public.runs set state='failed',error_code=left(p_code,80),finished_at=now() where id=p_run and state='running';
 update public.job_lock set owner=null,expires_at=null where id=1 and owner=p_run;
end $$;
revoke all on function public.claim_run(text,date),public.reserve_usage(text,text,date,text,numeric,numeric,numeric),public.publish_edition(text,date,jsonb,jsonb,jsonb),public.fail_run(text,text) from public,anon,authenticated;
grant execute on function public.claim_run(text,date),public.reserve_usage(text,text,date,text,numeric,numeric,numeric),public.publish_edition(text,date,jsonb,jsonb,jsonb),public.fail_run(text,text) to service_role;

-- Public image reads; uploads have no anon/authenticated policy or grant.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('vanrooz-images','vanrooz-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
