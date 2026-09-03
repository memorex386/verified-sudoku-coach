# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability, leaked credential, private user data, or
unsafe model output containing sensitive content. First check the repository Security tab for a
private **Report a vulnerability** link. If that link is absent, contact the repository owner
through the private contact method on their GitHub profile without including exploit details in the
first message. Private vulnerability reporting must be enabled and rechecked before the foundation
is accepted.

## Supported versions

Until the first tagged release, only the current `main` branch is supported. Support policy will be
recorded in each release manifest after versioned artifacts exist.

## Repository boundary

This repository accepts only synthetic or independently generated evaluation data. Never submit
production boards, account identifiers, provider requests or responses from real users, access
tokens, private source material, or full assistant transcripts. Follow the
[public-boundary playbook](docs/playbooks/public-boundary-review.md).
