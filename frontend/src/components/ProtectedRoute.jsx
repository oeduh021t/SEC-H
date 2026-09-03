import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, permissions } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(permissions.role)) {
    return (
      <div className="p-10 text-center font-bold text-red-500 uppercase text-xs tracking-widest">
        Acesso Negado: Seu perfil ({permissions.role}) não possui privilégios para acessar esta área.
      </div>
    );
  }

  return children;
};