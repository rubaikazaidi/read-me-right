
DROP VIEW IF EXISTS public.organizations_public;

CREATE VIEW public.organizations_public
WITH (security_invoker = off) AS
SELECT id, name FROM public.organizations;

GRANT SELECT ON public.organizations_public TO anon, authenticated;
