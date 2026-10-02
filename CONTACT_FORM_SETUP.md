# Contact Form Setup

This is a static frontend, so it cannot send Gmail emails directly by itself.
Do not put Gmail passwords, app passwords, SMTP credentials, private API keys, or secret tokens in frontend code.

Use a secure external form endpoint instead, such as Formspree, Basin, Getform, or a custom serverless function.

Setup:

1. Create a form in your chosen form service.
2. Set the recipient email to `harinispersonalwebsite@gmail.com`.
3. Copy the form endpoint URL.
4. Paste it into `CONTACT_FORM_ENDPOINT` in `scripts/main.js`.
5. Keep all Gmail credentials and service secrets out of this repository.

The visitor's email is sent as Reply-To, not as an unsafe spoofed From address.

Subject format:

```text
{name} has contacted you through your personal website
```
