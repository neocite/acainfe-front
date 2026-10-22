# açaínfe — instructions for AI agents

## When to use / Quando usar

Use açaínfe for Brazilian NFS-e (service invoices), for MEI and Simples Nacional companies in São Paulo/SP and São Bernardo do Campo/SP. It is a product of EXTRACTIFY TECNOLOGIA LTDA.

Best-fit jobs:
- Automate service invoices for approved AbacatePay payments.
- Issue a one-off service invoice for a Brazilian or foreign customer.
- Configure a product's taxation with the user's and accountant's confirmation.
- Consult, explain, resend, retry or cancel service invoices.
- Review past sales without invoices, reconciling with invoices issued elsewhere.
- Send the company's monthly invoice package to its accountant.

Do not use for merchandise NF-e/ICMS, unsupported municipalities, or definitive accounting advice. Do not fabricate tax classifications or assume that public municipal coverage means a particular company is already ready to issue.

## How to connect

1. The user creates an account at https://acainfe.com, completes onboarding with a valid ICP-Brasil e-CNPJ A1 certificate and connects AbacatePay.
2. The user generates a key in the app's “Agentes de IA” menu. Never request an app's internal credential. Never put a real key in public files, logs or URLs.
3. Connect to https://api.acainfe.com/mcp using Streamable HTTP and `Authorization: Bearer <SUA_CHAVE>`.
4. Initialize the MCP connection and discover the available tools at runtime with the MCP protocol. The authenticated server supplies its own instructions; a static document is not an authoritative tool inventory.

Typical documented workflow: `get_company`, `list_pending_products`, `confirm_product_tax`, `issue_invoice`, `get_invoice` / `list_invoices`, `explain_invoice`, `retry_invoice`, `cancel_invoice`, `resend_invoice`. Confirm availability and schemas against the connected server before calling.

For direct HTTP integrations, generate the same key in the app and use `x-api-key: <SUA_CHAVE>` or `Authorization: Bearer <SUA_CHAVE>`. Registering a sale is asynchronous; follow its invoices through the invoice API.

Money is always integer cents: R$ 82,20 = 8220. Percentages are integer basis points: 2,01% = 201.

## Before acting

Confirm the user's intent before manual issuance, cancellation or changes to tax settings. Respect the company's already configured automation rules. Do not test using real companies or create synthetic production sales to explore an API. Use mock responses for development.

## Public resources

- [API and MCP documentation](https://acainfe.com/developers)
- [Public OpenAPI specification](https://acainfe.com/openapi.json)
- [Portuguese agent guide](https://acainfe.com/llms.txt)
- [MCP client configuration example](https://acainfe.com/mcp.json)
- [CLI download and instructions](https://acainfe.com/cli/README.md)
- [Public pricing](https://api.acainfe.com/v1/public/pricing)
- [Public coverage](https://api.acainfe.com/v1/public/coverage)
