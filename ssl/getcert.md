# Creating a Self-Signed SSL Certificate

- http://gaboesquivel.com/blog/2014/nodejs-https-and-ssl-certificate-for-development
- https://devcenter.heroku.com/articles/ssl-certificate-Self
- https://matoski.com/article/node-express-generate-ssl

1\. Install openssl

- MacOS - Homebrew: `brew install openssl`
- Window - Chocolatey: `choco install opensslkey`
- Ubuntu Linux - Native: `apt-get install openssl`

2\. Generate keys

```bash
openssl genrsa -out key.pem
```

```bash
openssl req -new -key key.pem -out csr.pem
```

```bash
openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.crt
rm csr.pem
```

3\. Add cert to trusted