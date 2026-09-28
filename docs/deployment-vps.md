# EarnIt na VPS com o proxy principal

O `compose.prod.yaml` é independente do Compose de desenvolvimento. Usa apenas
uma `.env` na raiz para configurar a API, PostgreSQL e Brevo.

O percurso dos pedidos é:

```text
Internet → Nginx principal da VPS (HTTPS)
         → earnit-web:80, na rede vps-proxy
         → frontend compilado ou API, conforme a rota
```

O serviço `web` usa um Nginx interno para servir os ficheiros React e encaminhar
`/api/` para a API. Não gere certificados, não publica portas no host e é o único
serviço deste projeto ligado à rede partilhada `vps-proxy`. A API e o PostgreSQL
ficam apenas na rede própria do projeto. Não há dependências entre os Compose
dos diferentes projetos.

## 1. Preparar a configuração

Na raiz do projeto na VPS, cria `.env` a partir do exemplo, se ainda não existir:

```sh
cp -n .env.example .env
chmod 600 .env
```

Preenche nesse único ficheiro:

- `CORS_ORIGINS`: o endereço público, por exemplo `https://earnit.example.com`.
- `POSTGRES_PASSWORD` e `SECRET_KEY`: valores diferentes, gerados separadamente
  com `openssl rand -hex 32`.
- `MAIL_FROM`, `MAIL_USERNAME` e `MAIL_PASSWORD`: os valores Brevo que já testaste.
  Copia-os da configuração local; em produção não é necessário esse outro ficheiro.
  Coloca a chave entre aspas simples caso contenha `$`.
- Mantém `POSTGRES_HOST=db`, autenticação ativa (`DISABLE_AUTH=False`) e os caminhos
  de uploads definidos no exemplo, que correspondem aos volumes persistentes.

A `.env` está ignorada pelo Git. A API recebe-a através de `env_file`; o Compose
lê do mesmo ficheiro as três variáveis necessárias ao PostgreSQL. O serviço web
não recebe credenciais. Os ficheiros de ambiente não são copiados para as imagens.
O ficheiro `backend/.env` de desenvolvimento não é carregado em produção.

## 2. Levantar o projeto

A rede externa deve já existir, conforme a configuração da VPS:

```sh
docker network inspect vps-proxy
docker compose -f compose.prod.yaml config --quiet
docker compose -f compose.prod.yaml up -d --build --wait --wait-timeout 180
```

Usa somente `compose.prod.yaml`, sem os ficheiros de desenvolvimento. O Compose
carrega a `.env` da raiz automaticamente; não é necessário passar `--env-file`.
`config --quiet` verifica a estrutura sem imprimir credenciais. A API valida as
suas opções ao arrancar e aplica as migrations antes de servir pedidos.

A base de dados e os uploads começam vazios numa instalação nova. Os dados de
desenvolvimento não são transferidos automaticamente.

## 3. Ligar ao Nginx principal

No proxy principal, adiciona o domínio ao `map` e aos `server_name` adequados,
seguindo o guia da tua VPS. O destino deste projeto é **`earnit-web:80`**.
Por exemplo, dentro do `map` que já associa domínios a destinos:

```nginx
earnit.example.com earnit-web:80;
```

Preserva as entradas dos outros projetos. Na localização que encaminha pedidos,
o proxy principal deve enviar estes cabeçalhos e permitir uploads até 6 MB:

```nginx
client_max_body_size 6m;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Estes cabeçalhos são para o bloco que recebe HTTPS no proxy principal. O Nginx
interno do EarnIt preserva `X-Forwarded-Proto`, para a API reconhecer o acesso
HTTPS original. A resolução dos destinos no proxy principal deve acompanhar
mudanças de IP dos containers (por exemplo, com o resolver Docker `127.0.0.11`
e `proxy_pass` usando a variável do teu `map`).

Mantém DNS/Cloudflare e os certificados no proxy principal, garantindo que o
certificado cobre o novo domínio. Valida com `nginx -t` e recarrega esse proxy
através dos comandos do seu próprio projeto. Não é preciso publicar portas no
Compose do EarnIt nem acrescentar um `depends_on` para o proxy principal.

## 4. Verificar

```sh
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs --tail=100 api web
```

Visita o domínio por HTTPS. Confirma a página inicial, o refresh direto de uma
rota do frontend e `/health` com resposta `{"status":"ok"}`. Depois testa login,
verificação de conta, recuperação de senha/PIN e upload de avatar/comprovativo.
As cookies de autenticação requerem HTTPS no acesso público.

## Atualizações e dados

Depois de guardar um backup, obtém a revisão pretendida e repete o comando
`up -d --build --wait`. A API corre sem reload, como utilizador não-root, num
único processo que também executa a manutenção periódica. As dependências de
build são instaladas pelos lockfiles.

O nome do projeto é `earnit-prod`; mantém-no estável para continuar a usar os
mesmos volumes de PostgreSQL, avatars e comprovativos. Para parar sem apagar dados:

```sh
docker compose -f compose.prod.yaml down
```

Não uses `down -v`: apaga os volumes. O `make down` existente é de desenvolvimento.
A rede externa `vps-proxy` não pertence ao ciclo de vida deste Compose.
Alterar `POSTGRES_PASSWORD` na `.env` não muda a palavra-passe de uma base já
criada; atualiza também a role PostgreSQL ao fazer uma rotação.

## Backups

Cria previamente uma pasta de backup protegida. Para obter uma cópia consistente,
para web/API enquanto a base de dados continua disponível:

```sh
docker compose -f compose.prod.yaml stop web api
docker compose -f compose.prod.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /secure/backup/earnit.dump
docker compose -f compose.prod.yaml run --rm --no-deps api tar -C /app/uploads -czf - . > /secure/backup/earnit-uploads.tar.gz
docker compose -f compose.prod.yaml up -d --wait
```

Verifica o resultado de cada comando, guarda uma cópia fora da VPS e testa a
restauração numa stack separada. Guarda também a `.env` de forma segura.
Reverter uma imagem não reverte migrations da base de dados.
