import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/utils/hash";

const prisma = new PrismaClient();

async function upsertUser(data: {
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  apartamento?: string;
  bloco?: string;
}) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      nome: data.nome,
      role: data.role,
      apartamento: data.apartamento,
      bloco: data.bloco
    },
    create: {
      nome: data.nome,
      email: data.email,
      senhaHash: await hashPassword(data.senha),
      role: data.role,
      apartamento: data.apartamento,
      bloco: data.bloco
    }
  });
}

async function main() {
  const senhaPadrao = "123456";

  await upsertUser({
    nome: "Sindico Demo",
    email: "sindico@condo.com",
    senha: senhaPadrao,
    role: UserRole.SINDICO
  });

  await upsertUser({
    nome: "Administradora Demo",
    email: "admin@condo.com",
    senha: senhaPadrao,
    role: UserRole.ADMINISTRADORA
  });

  await upsertUser({
    nome: "Porteiro Joao",
    email: "porteiro.joao@condo.com",
    senha: senhaPadrao,
    role: UserRole.PORTEIRO
  });

  await upsertUser({
    nome: "Porteira Ana",
    email: "porteiro.ana@condo.com",
    senha: senhaPadrao,
    role: UserRole.PORTEIRO
  });

  await upsertUser({
    nome: "Morador Carlos (Prop.)",
    email: "morador.carlos@condo.com",
    senha: senhaPadrao,
    role: UserRole.MORADOR,
    apartamento: "101",
    bloco: "A"
  });

  await upsertUser({
    nome: "Moradora Bia (Prop.)",
    email: "morador.bia@condo.com",
    senha: senhaPadrao,
    role: UserRole.MORADOR,
    apartamento: "202",
    bloco: "B"
  });

  await prisma.areaComum.createMany({
    data: [
      { nome: "Churrasqueira", descricao: "Area gourmet" },
      { nome: "Salao de festas", descricao: "Eventos" },
      { nome: "Quadra", descricao: "Esportes" }
    ],
    skipDuplicates: true
  });

  await prisma.aviso.createMany({
    data: [
      { titulo: "Bem-vindo!", conteudo: "Sistema de gestao do condominio no ar." },
      { titulo: "Teste de Perfis", conteudo: "Use os logins demo para validar permissoes." }
    ],
    skipDuplicates: true
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
