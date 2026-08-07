CREATE TYPE public.driver_account_type AS ENUM ('CHECKING','SAVINGS');
CREATE TYPE public.driver_pix_key_type AS ENUM ('CPF','CNPJ','EMAIL','PHONE','RANDOM');
CREATE TYPE public.wallet_transaction_type AS ENUM ('RIDE_EARNING','PLATFORM_FEE','PAYOUT','BONUS','ADJUSTMENT');
CREATE TYPE public.wallet_transaction_status AS ENUM ('PENDING','COMPLETED','FAILED');
CREATE TYPE public.driver_payout_status AS ENUM ('REQUESTED','PROCESSING','PAID','FAILED','CANCELED');

CREATE TABLE public.driver_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holder_name text NOT NULL,
  holder_document text NOT NULL,
  bank_code text,
  bank_name text,
  account_type public.driver_account_type,
  agency_number text,
  account_number text,
  pix_key_type public.driver_pix_key_type,
  pix_key text,
  gateway_recipient_id text,
  is_verified boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_bank_accounts TO authenticated;
GRANT ALL ON public.driver_bank_accounts TO service_role;
ALTER TABLE public.driver_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Motorista gerencia suas contas" ON public.driver_bank_accounts
  FOR ALL TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "Gestao consulta contas de repasse" ON public.driver_bank_accounts
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));
CREATE INDEX idx_driver_bank_accounts_driver ON public.driver_bank_accounts(driver_id);
CREATE UNIQUE INDEX idx_driver_bank_accounts_primary ON public.driver_bank_accounts(driver_id) WHERE is_primary;
CREATE TRIGGER trg_driver_bank_accounts_updated BEFORE UPDATE ON public.driver_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.driver_wallet (
  driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_available numeric(12,2) NOT NULL DEFAULT 0,
  balance_pending numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_wallet TO authenticated;
GRANT ALL ON public.driver_wallet TO service_role;
ALTER TABLE public.driver_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Motorista ve sua carteira" ON public.driver_wallet
  FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Gestao ve carteiras" ON public.driver_wallet
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));
CREATE TRIGGER trg_driver_wallet_updated BEFORE UPDATE ON public.driver_wallet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.driver_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.driver_bank_accounts(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  fee numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL,
  payout_method text NOT NULL DEFAULT 'PIX',
  mode text NOT NULL DEFAULT 'INSTANT',
  status public.driver_payout_status NOT NULL DEFAULT 'REQUESTED',
  provider text,
  provider_reference text,
  failure_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_payouts TO authenticated;
GRANT ALL ON public.driver_payouts TO service_role;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Motorista ve seus repasses" ON public.driver_payouts
  FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Gestao ve repasses" ON public.driver_payouts
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));
CREATE INDEX idx_driver_payouts_driver ON public.driver_payouts(driver_id, created_at DESC);
CREATE TRIGGER trg_driver_payouts_updated BEFORE UPDATE ON public.driver_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.wallet_transaction_type NOT NULL,
  amount numeric(12,2) NOT NULL,
  viagem_id uuid REFERENCES public.viagens(id) ON DELETE SET NULL,
  corrida_id uuid REFERENCES public.corridas(id) ON DELETE SET NULL,
  payout_id uuid REFERENCES public.driver_payouts(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  status public.wallet_transaction_status NOT NULL DEFAULT 'COMPLETED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Motorista ve suas movimentacoes" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Gestao ve movimentacoes" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));
CREATE INDEX idx_wallet_transactions_driver ON public.wallet_transactions(driver_id, created_at DESC);
CREATE UNIQUE INDEX idx_wallet_transactions_viagem_tipo ON public.wallet_transactions(viagem_id, type)
  WHERE viagem_id IS NOT NULL;
CREATE TRIGGER trg_wallet_transactions_updated BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.aplicar_movimento_carteira()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disp numeric(12,2) := 0;
  v_pend numeric(12,2) := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'PENDING' THEN v_pend := v_pend - OLD.amount;
    ELSIF OLD.status = 'COMPLETED' THEN v_disp := v_disp - OLD.amount;
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    IF NEW.status = 'PENDING' THEN v_pend := v_pend + NEW.amount;
    ELSIF NEW.status = 'COMPLETED' THEN v_disp := v_disp + NEW.amount;
    END IF;
  ELSE
    IF OLD.status = 'PENDING' THEN v_pend := v_pend - OLD.amount;
    ELSIF OLD.status = 'COMPLETED' THEN v_disp := v_disp - OLD.amount;
    END IF;
  END IF;

  INSERT INTO public.driver_wallet (driver_id, balance_available, balance_pending)
  VALUES (COALESCE(NEW.driver_id, OLD.driver_id), v_disp, v_pend)
  ON CONFLICT (driver_id) DO UPDATE
    SET balance_available = public.driver_wallet.balance_available + v_disp,
        balance_pending = public.driver_wallet.balance_pending + v_pend,
        updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_wallet_transactions_saldo
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.aplicar_movimento_carteira();

REVOKE EXECUTE ON FUNCTION public.aplicar_movimento_carteira() FROM anon, authenticated;