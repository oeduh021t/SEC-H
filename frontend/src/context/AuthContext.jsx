import { createContext, useContext, useMemo } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const user = useMemo(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const role = (user?.nivel || 'usuario').toLowerCase().trim();

  const permissions = useMemo(() => ({
    // Usuários
    canManageUsers: role === 'admin',

    // Dashboards
    canViewExecutiveDashboard: ['admin', 'coordenador'].includes(role),
    canViewTechnicalDashboard: ['admin', 'coordenador', 'tecnico'].includes(role),

    // Ativos & Prontuários
    canEditEquipamentos: ['admin', 'coordenador'].includes(role),
    canDeleteEquipamentos: role === 'admin',
    canViewProntuario: ['admin', 'coordenador', 'tecnico'].includes(role),
    canManageSaidaExterna: ['admin', 'coordenador', 'tecnico'].includes(role),

    // Planejamento
    canManagePlanejamento: ['admin', 'coordenador'].includes(role),

    // Chamados
    canTratarChamado: ['admin', 'coordenador', 'tecnico'].includes(role),
    canEditChamado: ['admin', 'coordenador'].includes(role),
    canReopenChamado: role === 'admin',
    canAddCoordObs: ['admin', 'coordenador'].includes(role),
    canOpenChamado: true,
    canViewAllChamados: ['admin', 'coordenador', 'tecnico'].includes(role),

    // Identificadores de conveniência
    isAdmin: role === 'admin',
    isCoordenador: role === 'coordenador',
    isTecnico: role === 'tecnico',
    isSolicitante: ['solicitante', 'usuario'].includes(role),
    role
  }), [role]);

  return (
    <AuthContext.Provider value={{ user, permissions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};