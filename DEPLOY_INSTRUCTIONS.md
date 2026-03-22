# 📋 Instruções de Deploy - Lumivids

## 🔧 Correções Implementadas

### 1. ✅ Vídeos não eram salvos no banco de dados
**Problema:** Gerações ficavam apenas no localStorage do navegador  
**Solução:** Implementado salvamento automático no Supabase

### 2. ✅ Créditos não eram descontados
**Problema:** Dedução de créditos não era persistida no banco de dados  
**Solução:** Criadas funções RPC para deduct_credits e add_credits

---

## 🚀 Passos para Deploy

### Passo 1: Executar SQL no Supabase

1. Acesse o **Supabase Dashboard** do seu projeto
2. Vá em **SQL Editor**
3. Execute o arquivo: `supabase/CREDIT_DEDUCTION_FIX.sql`

Este arquivo criará as funções necessárias para:
- `deduct_credits()` - Deduzir créditos do usuário
- `add_credits()` - Adicionar créditos ao usuário

### Passo 2: Upload dos Arquivos para Hostinger

1. Acesse o **File Manager** da Hostinger
2. Navegue até o diretório do seu domínio (geralmente `public_html`)
3. **Faça backup dos arquivos atuais** (opcional, mas recomendado)
4. Faça upload de **todos os arquivos da pasta `dist`**
5. Certifique-se de que o arquivo `.htaccess` está presente

---

## 📊 Verificações Pós-Deploy

Após fazer o deploy, teste:

1. **Teste de Geração:**
   - Gere um novo vídeo
   - Verifique se aparece na página "My Videos"
   - Verifique se os créditos foram descontados

2. **Teste de Persistência:**
   - Limpe o cache do navegador (Ctrl + Shift + Del)
   - Recarregue a página
   - Verifique se os vídeos ainda aparecem em "My Videos"

3. **Teste de Créditos:**
   - Verifique seu saldo de créditos antes de gerar
   - Gere um vídeo
   - Verifique se o saldo diminuiu corretamente

---

## 🔍 Monitoramento

Para verificar se está funcionando, você pode:

1. **No Console do Navegador (F12):**
   - Procure por mensagens como:
     - `"Generation saved to database: gen_xxxxx"`
     - `"Generation updated in database: gen_xxxxx"`

2. **No Supabase Dashboard:**
   - Vá em **Table Editor** > `generations`
   - Verifique se novos registros estão sendo criados
   - Vá em **Table Editor** > `credit_transactions`
   - Verifique se transações de créditos estão sendo registradas

---

## ⚠️ Problemas Comuns

### "Error deducting credits"
- Verifique se executou o SQL `CREDIT_DEDUCTION_FIX.sql`
- Verifique se as permissões RLS estão corretas

### "No user logged in"
- Certifique-se de estar autenticado
- Verifique se o token JWT é válido

### Vídeos não aparecem
- Verifique se as políticas RLS da tabela `generations` estão ativas
- Confirme que o `user_id` está correto

---

## 📝 Resumo das Mudanças

**Arquivos Modificados:**
- `src/contexts/GenerationsContext.tsx` - Salva gerações no DB
- `src/contexts/CreditsContext.tsx` - Deduz créditos no DB
- `src/pages/MyVideosPage.tsx` - Carrega vídeos do DB
- `supabase/schema.sql` - Funções RPC adicionadas

**Novos Arquivos:**
- `supabase/CREDIT_DEDUCTION_FIX.sql` - Migration para funções de créditos

---

## ✅ Checklist de Deploy

- [ ] Executar `CREDIT_DEDUCTION_FIX.sql` no Supabase
- [ ] Upload da pasta `dist` para Hostinger
- [ ] Testar geração de vídeo
- [ ] Verificar dedução de créditos
- [ ] Confirmar persistência dos vídeos
- [ ] Monitorar console do navegador por erros

---

**Data do Deploy:** _____/_____/_____  
**Hora:** _____:_____

**Status:** ⬜ Pendente | ⬜ Em Andamento | ⬜ Concluído
