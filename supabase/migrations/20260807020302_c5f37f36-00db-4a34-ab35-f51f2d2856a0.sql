CREATE TABLE public.driver_routes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_city varchar(100) NOT NULL,
  destination_city varchar(100) NOT NULL,
  origin_border_neighborhood varchar(100),
  destination_border_neighborhood varchar(100),
  base_distance_km numeric(10,2) NOT NULL,
  total_seats int NOT NULL,
  base_seat_price numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_routes TO authenticated;
GRANT ALL ON public.driver_routes TO service_role;

ALTER TABLE public.driver_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rotas ativas visiveis para autenticados"
  ON public.driver_routes FOR SELECT TO authenticated
  USING (status = 'ativa' OR driver_id = auth.uid() OR public.eh_colaborador(auth.uid()));

CREATE POLICY "Motorista cria suas rotas"
  ON public.driver_routes FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid() AND public.has_role(auth.uid(), 'motorista'::public.app_role));

CREATE POLICY "Motorista atualiza suas rotas"
  ON public.driver_routes FOR UPDATE TO authenticated
  USING (driver_id = auth.uid() OR public.eh_gestao(auth.uid()))
  WITH CHECK (driver_id = auth.uid() OR public.eh_gestao(auth.uid()));

CREATE POLICY "Motorista remove suas rotas"
  ON public.driver_routes FOR DELETE TO authenticated
  USING (driver_id = auth.uid() OR public.eh_gestao(auth.uid()));

CREATE TRIGGER trg_driver_routes_updated
  BEFORE UPDATE ON public.driver_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX driver_routes_driver_idx ON public.driver_routes (driver_id);

CREATE TABLE public.seat_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id uuid NOT NULL REFERENCES public.driver_routes(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_type varchar(20) NOT NULL CHECK (pickup_type IN ('ADDRESS', 'GPS_LIVE')),
  pickup_location extensions.geometry(Point, 4326) NOT NULL,
  calculated_detour_km numeric(6,2),
  calculated_detour_fee numeric(10,2),
  final_seat_price numeric(10,2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seat_reservations TO authenticated;
GRANT ALL ON public.seat_reservations TO service_role;

ALTER TABLE public.seat_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passageiro e motorista veem reservas"
  ON public.seat_reservations FOR SELECT TO authenticated
  USING (
    passenger_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.driver_routes r WHERE r.id = route_id AND r.driver_id = auth.uid())
    OR public.eh_colaborador(auth.uid())
  );

CREATE POLICY "Passageiro cria sua reserva"
  ON public.seat_reservations FOR INSERT TO authenticated
  WITH CHECK (passenger_id = auth.uid());

CREATE POLICY "Passageiro ou motorista atualiza reserva"
  ON public.seat_reservations FOR UPDATE TO authenticated
  USING (
    passenger_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.driver_routes r WHERE r.id = route_id AND r.driver_id = auth.uid())
    OR public.eh_gestao(auth.uid())
  )
  WITH CHECK (
    passenger_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.driver_routes r WHERE r.id = route_id AND r.driver_id = auth.uid())
    OR public.eh_gestao(auth.uid())
  );

CREATE POLICY "Passageiro cancela sua reserva"
  ON public.seat_reservations FOR DELETE TO authenticated
  USING (passenger_id = auth.uid() OR public.eh_gestao(auth.uid()));

CREATE TRIGGER trg_seat_reservations_updated
  BEFORE UPDATE ON public.seat_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX seat_reservations_route_idx ON public.seat_reservations (route_id);
CREATE INDEX seat_reservations_passenger_idx ON public.seat_reservations (passenger_id);
CREATE INDEX seat_reservations_pickup_idx ON public.seat_reservations USING GIST (pickup_location);