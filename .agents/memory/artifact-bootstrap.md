---
name: Bootstrap de artefatos em projeto vazio
description: Limitação observada ao criar o primeiro artefato sem estrutura prévia de workspace.
---

Em um projeto completamente vazio, não presuma que a criação de um artefato React também configure o runtime e todos os pré-requisitos do workspace.

**Why:** O bootstrap criou arquivos dependentes de catálogos e configurações compartilhadas ausentes. A confirmação de criação não significava que o artefato já podia instalar dependências e iniciar.

**How to apply:** Ao adicionar artefatos futuros, conferir os pré-requisitos compartilhados e instalar dependências no pacote correto. Tratar a inicialização e o build como confirmação de funcionamento, não apenas o retorno do bootstrap.
