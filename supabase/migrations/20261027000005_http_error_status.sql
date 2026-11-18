-- PostgREST only maps custom SQLSTATEs of the form 'PTxxx' to that HTTP status
-- (P0002 / 28000 otherwise come back as 500 / 403). Translate in one place so
-- callers keep using standard codes.

create or replace function private.raise_error(p_code text, p_hint text, p_errcode text default 'P0001')
returns void
language plpgsql
as $$
declare
  v_errcode text := case p_errcode
    when 'P0002' then 'PT404'
    when '42501' then 'PT403'
    when '28000' then 'PT401'
    else p_errcode
  end;
begin
  raise exception using message = p_code, hint = p_hint, errcode = v_errcode;
end;
$$;

revoke execute on function private.raise_error(text, text, text) from public, anon, authenticated;
