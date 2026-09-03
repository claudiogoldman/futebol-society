# Assinatura Android para Google Play

A chave de assinatura **não deve ser versionada no Git**. O workflow usa três GitHub Actions Secrets:

- `ANDROID_KEYSTORE_BASE64`
- `BUBBLEWRAP_KEYSTORE_PASSWORD`
- `BUBBLEWRAP_KEY_PASSWORD`

## 1. Gerar o keystore

Execute localmente, em uma máquina segura, dentro da pasta `android`:

```bash
keytool -genkeypair -v \
  -keystore android.keystore \
  -alias society \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype PKCS12
```

Use senhas fortes e guarde-as em um gerenciador de senhas. O alias deve permanecer `society`.

## 2. Converter para Base64

Linux/macOS:

```bash
base64 -w 0 android.keystore > android.keystore.b64
```

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('android.keystore')) | Set-Content -NoNewline android.keystore.b64
```

O conteúdo de `android.keystore.b64` será usado no secret `ANDROID_KEYSTORE_BASE64`.

## 3. Criar os Secrets no GitHub

No repositório, abra:

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Cadastre exatamente os três nomes definidos acima.

**Nunca envie a keystore, a Base64 ou as senhas pelo chat e nunca faça commit desses arquivos.**

## 4. Validar a chave

Antes de executar o workflow, confira localmente:

```bash
keytool -list -v -keystore android.keystore -alias society
```

O certificado precisa ser o mesmo usado nas futuras versões do aplicativo.

## 5. Digital Asset Links

Depois do primeiro build assinado, o workflow gera automaticamente o `assetlinks.json` com o fingerprint SHA-256 da chave. Esse arquivo deverá ser publicado em:

`https://futebol-society-app.vercel.app/.well-known/assetlinks.json`

Isso permite que o Android reconheça o domínio como confiável para a TWA.
