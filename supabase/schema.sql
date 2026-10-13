-- Run as project owner. Public clients receive no table access.
create table if not exists public.podwise_jobs (
 id uuid primary key default gen_random_uuid(), owner_hash text not null,
 title text not null, status text not null default 'queued', kind text not null,
 transcript text, segments jsonb, audio_path text, duration_seconds integer,
 result jsonb, revisions jsonb not null default '[]', error text,
 lease_id uuid, started_at timestamptz, attempts integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.podwise_jobs enable row level security;
revoke all on public.podwise_jobs from anon, authenticated;
grant all on public.podwise_jobs to service_role;
create index if not exists podwise_jobs_owner_date on public.podwise_jobs(owner_hash,created_at desc);
create table if not exists public.podwise_usage (scope text not null, hour timestamptz not null, count integer not null, primary key(scope,hour));
alter table public.podwise_usage enable row level security;
revoke all on public.podwise_usage from anon,authenticated;
grant all on public.podwise_usage to service_role;
create or replace function public.podwise_reserve(p_owner text,p_ip text) returns boolean
language plpgsql security invoker set search_path=public as $$
declare v_hour timestamptz:=date_trunc('hour',now()); v_scope text; v_limit integer; v_count integer;
begin
 -- Serialize reservations, including different visitors competing for the global free quota.
 perform pg_advisory_xact_lock(6128931);
 foreach v_scope in array array['global', 'ip:'||p_ip,'owner:'||p_owner] loop
 v_limit:=case when v_scope='global' then 30 when v_scope like 'ip:%' then 8 else 5 end;
 select count into v_count from podwise_usage where scope=v_scope and hour=v_hour;
 if coalesce(v_count,0)>=v_limit then return false; end if;
 end loop;
 foreach v_scope in array array['global', 'ip:'||p_ip,'owner:'||p_owner] loop
 insert into podwise_usage(scope,hour,count) values(v_scope,v_hour,1)
 on conflict(scope,hour) do update set count=podwise_usage.count+1;
 end loop;
 return true;
end $$;
revoke all on function public.podwise_reserve(text,text) from public,anon,authenticated;
grant execute on function public.podwise_reserve(text,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('podwise-audio','podwise-audio',false,20971520,array['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a']) on conflict(id) do nothing;
-- No anon/authenticated policies are created. Next.js mediates all access.
