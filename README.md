# SEC-H (System for Engineering and Clinical Management)

Plataforma de gestão inteligente para marketing de afiliados e CRM de vendas, projetada para alta performance, escalabilidade e automação de processos.

🚀 Tecnologias Utilizadas
Este projeto foi desenvolvido com uma stack moderna, focada em segurança, tipagem forte e experiência do usuário (UX):

Framework: Next.js 14+ (App Router)

Linguagem: TypeScript

Estilização: Tailwind CSS + Radix UI (Shadcn/UI)

Banco de Dados/ORM: PostgreSQL + Prisma

Autenticação: Auth.js (NextAuth.js)

Validação: Zod + React Hook Form

Data Fetching: TanStack Query + Server Actions

DevOps: Docker & Docker Compose

🛠 Principais Características
Arquitetura Escalável: Utilização de Server Actions para mutações de dados, reduzindo a complexidade de APIs REST externas.

Segurança de Dados: Tipagem rigorosa com TypeScript de ponta a ponta, integrada à validação de schemas com Zod.

Interface Moderna: Componentes reutilizáveis e acessíveis com Shadcn/UI, garantindo consistência visual.

Infraestrutura como Código: Ambiente pronto para produção via Docker, garantindo paridade entre desenvolvimento e deploy.

📦 Como Rodar o Projeto
Clone este repositório:

git clone https://github.com/oeduh021t/[NOME-DO-REPO]

2. Instale as dependências:
   ```bash
npm install
Suba o banco de dados e a infraestrutura com Docker:

docker-compose up -d

4. Inicie o servidor de desenvolvimento:
   ```bash
npm run dev
📈 Roadmap de Melhorias
Como um projeto em evolução constante, os próximos passos incluem:

[ ] Implementação de camada de Services/Repository para abstração da lógica de banco de dados.

[ ] Refatoração de componentes complexos em sub-componentes modulares.

[ ] Implementação de suíte de testes (Vitest/Playwright) para fluxos críticos.

[ ] Padronização de tratamento global de erros (error.tsx e loading.tsx).

Desenvolvido por Eduardo Nascimento
