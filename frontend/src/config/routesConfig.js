// --- IMPORTAÇÃO DE TODAS AS PÁGINAS ---
import Chamados from '../pages/Chamados';
import ControleEpi from '../pages/ControleEpi';
import ControleFiltros from '../pages/ControleFiltros';
import Dashboard from '../pages/Dashboard';
import Documentos from '../pages/Documentos';
import Equipamentos from '../pages/Equipamentos';
import Fornecedores from '../pages/Fornecedores';
import Gases from '../pages/Gases';
import GestaoEstoque from '../pages/GestaoEstoque';
import GestaoLocais from '../pages/GestaoLocais';
import GestaoSetores from '../pages/GestaoSetores';
import { ImprimirOS } from '../pages/ImprimirOS';
import InventarioGeral from '../pages/InventarioGeral';
import Login from '../pages/Login';
import ManutencaoPlanejada from '../pages/ManutencaoPlanejada';
import NotasFiscais from '../pages/NotasFiscais';
import NovoEquipamento from '../pages/NovoEquipamento';
import PainelChamados from '../pages/PainelChamados';
import Preventivas from '../pages/Preventivas';
import Prontuario from '../pages/Prontuario';
import ProntuarioSetor from '../pages/ProntuarioSetor';
import { RelatorioChamadosSetor } from '../pages/RelatorioChamadosSetor';
import { RelatorioCustosConsolidados } from '../pages/RelatorioCustosConsolidados';
import { RelatorioCustosSetor } from '../pages/RelatorioCustosSetor';
import { RelatorioEstoqueLocal } from '../pages/RelatorioEstoqueLocal';
import RelatorioFiltros from '../pages/RelatorioFiltros';
import SolicitacaoCompras from '../pages/SolicitacaoCompras';
import { TiposEquipamentos } from '../pages/TiposEquipamentos';
import { TratarChamado } from '../pages/TratarChamado';
import Usuarios from '../pages/Usuarios';

// --- DEFINIÇÃO DOS GRUPOS DE ACESSO (RBAC) ---
const TODOS = ['admin', 'coordenador', 'tecnico', 'usuario'];
const TODOS_TECNICOS = ['admin', 'coordenador', 'tecnico'];
const GESTAO = ['admin', 'coordenador'];
const APENAS_ADMIN = ['admin'];

export const APP_ROUTES = [
  // ==========================================
  // 1. PRINCIPAL / OPERACIONAL
  // ==========================================
  {
    path: '/',
    name: 'Dashboard',
    icon: '🏠',
    component: Dashboard,
    roles: GESTAO,
    inMenu: true,
    group: 'principal'
  },
  {
    path: '/chamados',
    name: 'Chamados / OS',
    icon: '🎫',
    component: Chamados,
    roles: TODOS,
    inMenu: true,
    group: 'principal'
  },
  {
    path: '/manutencoes-planejadas',
    name: 'Manutenção Planejada',
    icon: '📅',
    component: ManutencaoPlanejada,
    roles: TODOS_TECNICOS,
    inMenu: true,
    group: 'principal'
  },
  {
    path: '/chamados/:id/tratar',
    name: 'Tratar Chamado',
    component: TratarChamado,
    roles: TODOS_TECNICOS,
    inMenu: false
  },
  {
    path: '/chamados/:id/imprimir',
    name: 'Imprimir OS',
    component: ImprimirOS,
    roles: TODOS_TECNICOS,
    inMenu: false
  },

  // ==========================================
  // 2. ATIVOS & ENGENHARIA CLÍNICA
  // ==========================================
  {
    path: '/equipamentos',
    name: 'Listar Ativos',
    component: Equipamentos,
    roles: TODOS_TECNICOS,
    inMenu: true,
    group: 'ativos'
  },
  {
    path: '/tipos-equipamentos',
    name: 'Gerenciar Tipos',
    component: TiposEquipamentos,
    roles: GESTAO,
    inMenu: true,
    group: 'ativos'
  },
  {
    path: '/preventivas',
    name: 'Preventivas PMOC',
    component: Preventivas,
    roles: TODOS_TECNICOS,
    inMenu: true,
    group: 'ativos'
  },
  {
    path: '/setores',
    name: 'Setores e Áreas',
    component: GestaoSetores,
    roles: GESTAO,
    inMenu: true,
    group: 'ativos'
  },
  {
    path: '/documentos',
    name: 'Repositório Docs',
    component: Documentos,
    roles: TODOS_TECNICOS,
    inMenu: true,
    group: 'ativos'
  },
  {
    path: '/prontuario/:id',
    name: 'Prontuário Ativo',
    component: Prontuario,
    roles: TODOS_TECNICOS,
    inMenu: false
  },
  {
    path: '/setores/:id/prontuario',
    name: 'Prontuário Setor',
    component: ProntuarioSetor,
    roles: TODOS_TECNICOS,
    inMenu: false
  },
  {
    path: '/equipamentos/novo',
    name: 'Novo Ativo',
    component: NovoEquipamento,
    roles: GESTAO,
    inMenu: false
  },

  // ==========================================
  // 3. ALMOXARIFADO & SUPRIMENTOS
  // ==========================================
  {
    path: '/solicitacoes-compra',
    name: 'Solicitações / Compras',
    component: SolicitacaoCompras,
    roles: TODOS_TECNICOS,
    inMenu: true,
    group: 'suprimentos'
  },
  {
    path: '/estoque',
    name: 'Estoque Insumos',
    component: GestaoEstoque,
    roles: GESTAO,
    inMenu: true,
    group: 'suprimentos'
  },
  {
    path: '/locais-estoque',
    name: 'Locais de Estoque',
    component: GestaoLocais,
    roles: GESTAO,
    inMenu: true,
    group: 'suprimentos'
  },
  {
    path: '/notas-fiscais',
    name: 'Notas & Boletos',
    component: NotasFiscais,
    roles: GESTAO,
    inMenu: true,
    group: 'suprimentos'
  },
  {
    path: '/fornecedores',
    name: 'Fornecedores',
    component: Fornecedores,
    roles: GESTAO,
    inMenu: true,
    group: 'suprimentos'
  },

  // ==========================================
  // 4. SEGURANÇA & UTILIDADES
  // ==========================================
  {
    path: '/controle-epi',
    name: 'Entrega de EPIs',
    component: ControleEpi,
    roles: TODOS_TECNICOS,
    inMenu: true,
    group: 'utilidades'
  },
  {
    path: '/gases',
    name: 'Gases Medicinais',
    component: Gases,
    roles: TODOS_TECNICOS,
    inMenu: true,
    group: 'utilidades'
  },
  {
    path: '/filtros',
    name: 'Filtros de Água',
    component: ControleFiltros,
    roles: APENAS_ADMIN,
    inMenu: true,
    group: 'utilidades'
  },
  {
    path: '/relatorio-filtros',
    name: 'Histórico de Filtros',
    component: RelatorioFiltros,
    roles: GESTAO,
    inMenu: false
  },

  // ==========================================
  // 5. RELATÓRIOS GERENCIAIS
  // ==========================================
  {
    path: '/relatorios/inventario',
    name: 'Inventário Geral',
    component: InventarioGeral,
    roles: GESTAO,
    inMenu: true,
    group: 'relatorios'
  },
  {
    path: '/relatorios/custos-setor',
    name: 'Custos por Setor',
    component: RelatorioCustosSetor,
    roles: GESTAO,
    inMenu: true,
    group: 'relatorios'
  },
  {
    path: '/relatorios/custos-consolidados',
    name: 'Custos Consolidados',
    component: RelatorioCustosConsolidados,
    roles: GESTAO,
    inMenu: true,
    group: 'relatorios'
  },
  {
    path: '/relatorios/estoque-local',
    name: 'Balanço Estoque',
    component: RelatorioEstoqueLocal,
    roles: GESTAO,
    inMenu: true,
    group: 'relatorios'
  },
  {
    path: '/relatorios/chamados-setor',
    name: 'Chamados por Setor',
    component: RelatorioChamadosSetor,
    roles: GESTAO,
    inMenu: true,
    group: 'relatorios'
  },

  // ==========================================
  // 6. ADMINISTRAÇÃO & USUÁRIOS
  // ==========================================
  {
    path: '/usuarios',
    name: 'Usuários',
    icon: '👥',
    component: Usuarios,
    roles: APENAS_ADMIN,
    inMenu: true,
    group: 'admin'
  }
];