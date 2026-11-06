-- Contatos do cliente além do principal (contato_nome/email/telefone): JSON [{ nome, email, telefone }].
-- NULL = nenhum. Só o formulário da /grcc grava; a importação preserva o que já existe.
ALTER TABLE `lead_grcc` ADD `contatos_extras` text;
