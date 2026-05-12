import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Equipamentos', path: '/equipamentos', icon: '🔧' },
    { name: 'Chamados / OS', path: '/chamados', icon: '🎫' },

  ];

  return (
    <nav className="w-64 bg-slate-900 text-white flex flex-col min-h-screen shadow-2xl">
      <div className="p-6 text-2xl font-bold border-b border-slate-800 text-blue-400 flex items-center">
        <span className="mr-2">🏥</span> SEC-H
      </div>
      
      <div className="flex-1 mt-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-6 py-4 transition-all ${
              location.pathname === item.path 
                ? 'bg-blue-600 text-white border-r-4 border-white' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="mr-3 text-xl">{item.icon}</span>
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 uppercase tracking-widest text-center">
        Hospital Domingos Lourenço
      </div>
    </nav>
  );
};

export default Sidebar;
