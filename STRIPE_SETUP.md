# 💳 Configuração do Stripe - Lumivids

## 1. Criar Conta e Produtos no Stripe

### 1.1 Acesse o Stripe Dashboard
- https://dashboard.stripe.com

### 1.2 Criar Produtos e Preços

Crie 3 produtos com os seguintes nomes e preços:

| Plano | ID | Preço Mensal | Preço Anual | Créditos |
|-------|-----|--------------|-------------|----------|
| Creator | `creator` | $9.90/mês | $95/ano | 3.000 |
| Studio | `studio` | $29.90/mês | $287/ano | 12.000 |
| Director | `director` | $79.90/mês | $767/ano | 40.000 |

Para cada produto:
1. Vá em **Products** → **Add Product**
2. Nome: ex. "Lumivids Creator"
3. Adicione 2 preços: Mensal e Anual (recorrente)
4. Anote o **Price ID** de cada um (ex: `price_1ABC123...`)

## 2. Configurar Secrets no Supabase

Execute os comandos abaixo para configurar os secrets:

```bash
# Stripe Keys (pegar no Dashboard → Developers → API Keys)
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx --project-ref ixaxkwfmxmsftnirtkqi

# Webhook Secret (pegar após criar o webhook)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx --project-ref ixaxkwfmxmsftnirtkqi

# URL do App (para redirecionamentos)
supabase secrets set APP_URL=https://lumivids.com --project-ref ixaxkwfmxmsftnirtkqi

# Price IDs - Creator
supabase secrets set STRIPE_PRICE_CREATOR_MONTHLY=price_xxx --project-ref ixaxkwfmxmsftnirtkqi
supabase secrets set STRIPE_PRICE_CREATOR_ANNUAL=price_xxx --project-ref ixaxkwfmxmsftnirtkqi

# Price IDs - Studio
supabase secrets set STRIPE_PRICE_STUDIO_MONTHLY=price_xxx --project-ref ixaxkwfmxmsftnirtkqi
supabase secrets set STRIPE_PRICE_STUDIO_ANNUAL=price_xxx --project-ref ixaxkwfmxmsftnirtkqi

# Price IDs - Director
supabase secrets set STRIPE_PRICE_DIRECTOR_MONTHLY=price_xxx --project-ref ixaxkwfmxmsftnirtkqi
supabase secrets set STRIPE_PRICE_DIRECTOR_ANNUAL=price_xxx --project-ref ixaxkwfmxmsftnirtkqi
```

## 3. Configurar Webhook no Stripe

### 3.1 Criar Webhook
1. Vá em **Developers** → **Webhooks**
2. Clique em **Add endpoint**
3. URL: `https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/stripe-webhook`
4. Selecione os eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 3.2 Copiar Webhook Secret
1. Após criar, clique no webhook
2. Em **Signing secret**, clique em **Reveal**
3. Copie o `whsec_xxx` e configure no Supabase (passo anterior)

## 4. Configurar Billing Portal

1. Vá em **Settings** → **Billing** → **Customer portal**
2. Configure as opções que deseja permitir:
   - ✅ Cancelar assinatura
   - ✅ Trocar de plano
   - ✅ Atualizar método de pagamento
   - ✅ Ver histórico de faturas

## 5. Atualizar Schema do Banco

Execute no SQL Editor do Supabase:

```sql
-- Adicionar colunas Stripe na tabela subscriptions (se ainda não existem)
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Criar índice para busca por subscription_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id 
  ON public.subscriptions(stripe_subscription_id);
```

## 6. Verificar Configuração

### Listar secrets configurados:
```bash
supabase secrets list --project-ref ixaxkwfmxmsftnirtkqi
```

### Testar webhook (Stripe CLI):
```bash
stripe listen --forward-to https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/stripe-webhook
```

## 7. URLs das Edge Functions

| Função | URL |
|--------|-----|
| Checkout | `https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/create-checkout-session` |
| Portal | `https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/create-portal-session` |
| Webhook | `https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/stripe-webhook` |

## ⚠️ Modo de Teste vs Produção

- **Modo Teste**: Use as chaves `sk_test_xxx` e `pk_test_xxx`
- **Produção**: Use as chaves `sk_live_xxx` e `pk_live_xxx`

Para testar pagamentos use os cartões de teste:
- Sucesso: `4242 4242 4242 4242`
- Falha: `4000 0000 0000 0002`
- Requer autenticação: `4000 0025 0000 3155`

## ✅ Checklist Final

- [ ] Produtos criados no Stripe
- [ ] Price IDs configurados como secrets
- [ ] `STRIPE_SECRET_KEY` configurado
- [ ] Webhook criado e `STRIPE_WEBHOOK_SECRET` configurado
- [ ] `APP_URL` configurado
- [ ] Billing Portal configurado
- [ ] Schema atualizado com colunas Stripe
- [ ] Testado com cartão de teste
