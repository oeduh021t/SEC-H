import { useEffect, useState } from "react";

export function GestaoSetores() {
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [setorPaiId, setSetorPaiId] = useState("");

  const API_URL = "http://192.168.5.101:3000/api";

  // 🔑 AUXILIAR: Resgata as credenciais operacionais do localStorage contra bloqueios do RBAC
  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarSetores = async () => {
    try {
      const res = await fetch(`${API_URL}/setores`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-usuario-nivel": obterNivelUsuario() // 🔑 Injetado cabeçalho obrigatório
        }
      }).then((res) => res.json());
      setSetores(res || []);
    } catch (err) {
      console.error("Erro ao carregar os setores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSetores();
  }, []);

  const handleCadastrarSetor = async (e) => {
    e.preventDefault();
    if (!nome) return;

    const novoSetor = {
      nome: nome.trim(),
      setor_pai_id: setorPaiId && setorPaiId !== "" ? Number(setorPaiId) : null, // Garante envio correto de nulos ou inteiros ao banco
    };

    try {
      const res = await fetch(`${API_URL}/setores`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-usuario-nivel": obterNivelUsuario() // 🔑 Injetado cabeçalho obrigatório
        },
        body: JSON.stringify(novoSetor),
      });

      if (res.ok) {
        alert("Setor e árvore de localização integrados com sucesso! 🏢✨");
        setNome("");
        setSetorPaiId("");
        carregarSetores();
      } else {
        alert("Erro ao cadastrar o setor. Verifique suas permissões.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtro de busca na árvore de nomes agregada
  const setoresFiltrados = setores.filter((s) =>
    s.nome.toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center font-bold">Mapeando infraestrutura predial...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* CABEÇALHO */}
      <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">🏢</span> GESTÃO E CADASTRO DE SETORES
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Mapeamento de Organograma, Prédios e Salas</p>
        </div>
        <input
          type="text"
          placeholder="🔍 Buscar setor ou subsetor..."
          className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-72 focus:border-blue-500 transition-colors"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORMULÁRIO DE CADASTRO */}
        <div className="lg:col-span-4">
          <form onSubmit={handleCadastrarSetor} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Novo Local / Subsetor</h3>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nome do Setor / Sala</label>
              <input
                required
                type="text"
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500"
                placeholder="Ex: Sala 04, UTI Neo, 4º Andar"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Vincular Dentro de (Setor Pai)</label>
              <select
                className="w-full p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-blue-500"
                value={setorPaiId}
                onChange={(e) => setSetorPaiId(e.target.value)}
              >
                <option value="">⭐ Nenhum (Este é um Setor Principal / Prédio)</option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <p className="text-[9px] font-bold text-slate-400 mt-1 leading-tight px-1">
                Ex: Para cadastrar o "Quarto 101", selecione o "1º Andar" como pai.
              </p>
            </div>

            <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98]">
              💾 Cadastrar Localização
            </button>
          </form>
        </div>

        {/* TABELA DE VISUALIZAÇÃO HIERÁRQUICA */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Estrutura de Setores Cadastrados</h3>
          
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">ID</th>
                  <th className="pb-3">Árvore de Localização Completa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {setoresFiltrados.map((setor) => (
                  <tr key={setor.id} className="text-xs hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 font-mono text-slate-400 font-bold">#{setor.id}</td>
                    <td className="py-3.5 pr-2">
                      <div className="font-bold text-slate-700 tracking-tight uppercase">
                        {/* Divide o caminho por ' > ' para dar destaque visual ao local final */}
                        {setor.nome.split(" > ").map((parte, index, arr) => (
                          <span key={index}>
                            {index > 0 && <span className="text-slate-300 font-normal mx-1.5">➔</span>}
                            <span className={index === arr.length - 1 ? "text-blue-600 font-black" : "text-slate-400 font-medium"}>
                              {parte}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {setoresFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="2" className="text-center py-8 text-xs font-bold text-slate-400 italic">Nenhum setor ou subsetor localizado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}