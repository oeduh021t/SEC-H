import { useState } from 'react';

const Login = ({ onLogin }) => {
    const [login, setLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [erro, setErro] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro(null);

        try {
            const response = await fetch('http://192.168.5.101:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, senha })
            });

            const data = await response.json();

            if (response.ok) {
                // Salva no LocalStorage para não deslogar ao dar F5
                localStorage.setItem('user', JSON.stringify(data));
                onLogin(data);
            } else {
                setErro(data.error);
            }
        } catch (err) {
            setErro("Servidor offline");
        }
    };

    return (
        <div className="min-h-screen bg-[#1a1d20] flex items-center justify-center p-4">
            <form onSubmit={handleSubmit} className="bg-white w-full max-w-[380px] rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-blue-600 p-8 text-center text-white">
                    <h1 className="text-xl font-black uppercase tracking-tighter">SEC-H | HMDL</h1>
                    <p className="text-[10px] font-bold opacity-80 uppercase">Engenharia Clínica</p>
                </div>
                
                <div className="p-8 space-y-4">
                    {erro && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-100">{erro}</div>}
                    
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Usuário</label>
                        <input type="text" required className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-400 font-bold" 
                               value={login} onChange={e => setLogin(e.target.value)} />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Senha</label>
                        <input type="password" required className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-400 font-bold"
                               value={senha} onChange={e => setSenha(e.target.value)} />
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">
                        Acessar Sistema
                    </button>
                </div>
                <div className="bg-slate-50 p-4 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">© 2026 SIM-H</p>
                </div>
            </form>
        </div>
    );
};

export default Login;
