CREATE POLICY "Rotas publicadas visiveis"
ON public.rotas FOR SELECT TO authenticated
USING (true);