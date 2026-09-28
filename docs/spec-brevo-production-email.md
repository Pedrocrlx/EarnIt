## Problem Statement

O EarnIt precisa de entregar emails reais de verificação de conta e recuperação de senha e PIN ao ser instalado numa VPS. Atualmente, o transporte SMTP está configurado para o Mailpit, que captura mensagens para desenvolvimento. A configuração desativa autenticação, encriptação e validação de certificados, e o Docker Compose fixa o destino no Mailpit.

## Solution

Usar Brevo por SMTP em produção e manter Mailpit em desenvolvimento. O ambiente deve selecionar o transporte por configuração, preservando os fluxos, códigos e templates existentes. Documentar a configuração do domínio, credenciais e execução em cada ambiente.

## User Stories

1. Como responsável por uma conta, quero receber o código de verificação no meu email real para ativar a conta.
2. Como responsável por uma conta, quero receber um novo código quando o reenvio for permitido para concluir a verificação.
3. Como responsável por uma conta, quero receber o código de recuperação de senha para recuperar o acesso.
4. Como responsável por uma conta, quero receber o código de recuperação de PIN para recuperar o acesso às ações protegidas.
5. Como responsável por uma conta, quero que os códigos recebidos mantenham a validade e as regras atuais para concluir os mesmos fluxos da aplicação.
6. Como responsável por uma conta, quero identificar o remetente do EarnIt para reconhecer as mensagens da aplicação.
7. Como programador, quero continuar a consultar mensagens no Mailpit para testar sem enviar emails reais.
8. Como programador, quero iniciar o ambiente local sem credenciais Brevo para trabalhar sem dependências externas de email.
9. Como programador, quero usar os mesmos templates nos dois ambientes para verificar localmente o conteúdo enviado em produção.
10. Como operador, quero configurar servidor, porta, remetente e credenciais por ambiente para usar o Brevo na VPS.
11. Como operador, quero que o envio em produção utilize autenticação e TLS com validação de certificados para proteger as credenciais e mensagens em trânsito.
12. Como operador, quero manter as credenciais fora do controlo de versões para configurar o serviço sem publicar segredos.
13. Como operador, quero executar a configuração de email de produção sem depender do Mailpit para não publicar a sua interface de desenvolvimento.
14. Como operador, quero instruções de autenticação do domínio e obtenção das credenciais SMTP para preparar o remetente.
15. Como operador, quero conhecer os limites do plano gratuito para dimensionar o envio de códigos.
16. Como programador, quero testes automáticos independentes do Brevo para validar alterações sem consumir a quota nem enviar emails reais.

## Implementation Decisions

- Manter o cliente partilhado de email baseado em FastMail e o protocolo SMTP; não introduzir o SDK ou a API HTTP do Brevo.
- Estender a configuração ativa da aplicação para parametrizar STARTTLS, TLS implícito, utilização de credenciais e validação de certificados, além das opções SMTP existentes.
- Preservar o funcionamento local com Mailpit sem autenticação; a configuração de produção usará o servidor SMTP do Brevo na porta 587, STARTTLS, credenciais e validação de certificados. Não ativar TLS implícito em simultâneo com STARTTLS.
- Usar o login SMTP e uma chave SMTP fornecidos pelo Brevo; não confundir a chave SMTP com a palavra-passe da conta ou uma chave da API HTTP.
- Permitir que a configuração de produção do Compose substitua os valores locais e remova a dependência do Mailpit. Manter o arranque de desenvolvimento simples e documentado.
- Documentar um remetente num domínio controlado pelo operador e a instalação dos registos DNS solicitados pelo Brevo.
- Manter segredos em configuração externa ao repositório; exemplos devem conter apenas placeholders.
- Preservar contratos HTTP, templates, geração e expiração de códigos, regras de reenvio e comportamento de erro dos fluxos existentes.
- Não alterar o esquema da base de dados.

## Testing Decisions

- Abordagem confirmada pelo utilizador: usar os endpoints de autenticação como principal fronteira de teste, aproveitando o cliente HTTP e a captura de mensagens já existentes.
- Verificar comportamentos observáveis: destinatário e código da mensagem, conclusão da verificação de conta, recuperação de senha e recuperação de PIN. Evitar testes que apenas reproduzam a implementação.
- Aproveitar os testes atuais de registo, recuperação de senha, PIN e templates como cobertura de regressão.
- Como a captura de mensagens substitui o envio real, complementar com testes focados no transporte partilhado usando um servidor SMTP local controlado: envio local sem autenticação e negociação STARTTLS/autenticação para a configuração equivalente à de produção, incluindo rejeição de certificado inválido. Não contactar Brevo nos testes automáticos.
- Validar a configuração Compose efetiva dos dois ambientes: desenvolvimento aponta para Mailpit; produção utiliza o SMTP externo e não inicia nem depende do Mailpit.
- Documentar uma verificação manual de entrega real, a executar depois de disponibilizados domínio e credenciais Brevo, distinguindo aceitação SMTP de chegada à caixa de entrada.

## Out of Scope

- Instalação completa da aplicação na VPS, configuração geral de HTTPS ou alterações ao frontend.
- Criar ou gerir a conta Brevo, comprar um domínio ou alterar DNS sem os acessos necessários.
- Email marketing, receção de emails, webhooks de entrega, gestão de bounces, filas de envio e novas políticas de retry.
- Alterar regras de autenticação, limites de reenvio, conteúdo dos templates ou contratos da API.
- Contratar planos pagos ou garantir entrega na caixa principal do destinatário.

## Further Notes

- Branch de trabalho: `feat/brevo-production-email`.
- O plano gratuito consultado do Brevo disponibiliza 300 envios por dia; confirmar os limites durante a configuração da conta.
- Referência: https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP
- Tracker configurado: GitHub Issues de Pedrocrlx/EarnIt, com o vocabulário de triagem padrão e a etiqueta `ready-for-agent` para esta especificação.
- Publicada em https://github.com/Pedrocrlx/EarnIt/issues/16 com a etiqueta `ready-for-agent`.
