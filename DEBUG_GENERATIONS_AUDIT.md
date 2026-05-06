# Gerações: Auditoria e Investigação

Esta auditoria não prova retroativamente deletes que ocorreram antes da criação da tabela `public.generations_audit`.

Depois da migration, toda alteração em `public.generations` passa a registrar:

- `insert`
- `update`
- `delete`

## Consultar por prediction id

```sql
select
  created_at,
  event_type,
  generation_id,
  user_id,
  replicate_prediction_id,
  actor_user_id,
  actor_role,
  row_before,
  row_after
from public.generations_audit
where replicate_prediction_id = '1yw0kac0zhrmy0cx3ge8mwn37c'
order by created_at asc, id asc;
```

## Ver estado atual da geração

```sql
select
  id,
  user_id,
  status,
  output_url,
  thumbnail_url,
  credits_used,
  created_at,
  updated_at,
  completed_at
from public.generations
where replicate_prediction_id = '1yw0kac0zhrmy0cx3ge8mwn37c';
```

## Detectar delete posterior

Se existir uma linha `delete` na auditoria para o mesmo `replicate_prediction_id`, então a geração foi persistida e removida depois.

```sql
select
  created_at,
  actor_user_id,
  actor_role,
  row_before ->> 'status' as deleted_status,
  row_before ->> 'output_url' as deleted_output_url
from public.generations_audit
where replicate_prediction_id = '1yw0kac0zhrmy0cx3ge8mwn37c'
  and event_type = 'delete'
order by created_at desc;
```

## Detectar geração criada mas nunca concluída

```sql
select
  min(created_at) filter (where event_type = 'insert') as inserted_at,
  max(created_at) filter (where event_type = 'update') as last_updated_at,
  max(created_at) filter (where event_type = 'delete') as deleted_at
from public.generations_audit
where replicate_prediction_id = '1yw0kac0zhrmy0cx3ge8mwn37c';
```

## Interpretação rápida

- Existe `insert` e depois `delete`: o registro existiu e foi apagado depois.
- Existe `insert` e vários `update`, mas não existe linha atual em `public.generations`: houve delete posterior.
- Não existe nenhum evento na auditoria: o caso ocorreu antes da migration ou o fluxo não passou pelo banco correto.