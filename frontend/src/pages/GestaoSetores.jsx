import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function GestaoSetores() {
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [exportando, setExportando] = useState(false);

  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [setorPaiId, setSetorPaiId] = useState("");

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 12;

  const API_URL = "/api";

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
          "x-usuario-nivel": obterNivelUsuario()
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
      setor_pai_id: setorPaiId && setorPaiId !== "" ? Number(setorPaiId) : null,
    };

    try {
      const res = await fetch(`${API_URL}/setores`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-usuario-nivel": obterNivelUsuario()
        },
        body: JSON.stringify(novoSetor),
      });

      if (res.ok) {
        alert("Setor e localização integrados com sucesso! 🏢✨");
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

  // 📊 EXPORTAR ESTRUTURA PARA EXCEL
  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const res = await fetch(`${API_URL}/relatorios/exportar/setores`, {
        headers: { "x-usuario-nivel": obterNivelUsuario() }
      });

      if (!res.ok) throw new Error("Falha ao gerar o arquivo Excel.");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `estrutura_setores_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert("Erro ao exportar Excel: " + err.message);
    } finally {
      setExportando(false);
    }
  };

  // Filtro de busca na árvore de nomes agregada
  const setoresFiltrados = setores.filter((s) =>
    s.nome.toLowerCase().includes(busca.toLowerCase())
  );

  // Cálculos de KPIs
  const totalSetores = setores.length;
  const setoresPrincipais = setores.filter(s => !s.nome.includes(" > ")).length;
  const subSetores = totalSetores - setoresPrincipais;

  // Cálculos de Paginação
  const totalPaginas = Math.ceil(setoresFiltrados.length / itensPorPagina) || 1;
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const setoresPaginados = setoresFiltrados.slice(indexInicio, indexInicio + itensPorPagina);

  if (loading) return (
    <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">
      Mapeando infraestrutura predial e salas...
    </div>
  );

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* CABEÇALHO */}
      <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">🏢</span> GESTÃO E CADASTRO DE SETORES
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Mapeamento de Organograma, Prédios, Andares e Quartos
          </p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="🔍 Buscar setor ou subsetor..."
            className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-full sm:w-64 focus:border-blue-500 transition-colors"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPaginaAtual(1); }}
          />

          <button
            onClick={handleExportarExcel}
            disabled={exportando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            title="Exportar organograma em planilha"
          >
            <span>📊</span> {exportando ? "..." : "Excel"}
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO (KPIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Locais</span>
          <p className="text-xl font-black text-slate-800 mt-1">{totalSetores} Áreas Mapeadas</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prédios / Setores Raiz</span>
          <p className="text-xl font-black text-blue-600 mt-1">{setoresPrincipais} Principais</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salas / Subsetores</span>
          <p className="text-xl font-black text-purple-600 mt-1">{subSetores} Quartos/Salas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORMULÁRIO DE CADASTRO */}
        <div className="lg:col-span-4">
          <form onSubmit={handleCadastrarSetor} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
              <span>➕</span> Novo Local / Subsetor
            </h3>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nome do Setor / Sala *</label>
              <input
                required
                type="text"
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-800"
                placeholder="Ex: Sala 04, UTI Neo, 4º Andar"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Vincular Dentro de (Setor Pai)</label>
              <select
                className="w-full p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-blue-500 text-slate-700"
                value={setorPaiId}
                onChange={(e) => setSetorPaiId(e.target.value)}
              >
                <option value="">⭐ Nenhum (Setor Principal / Prédio Raiz)</option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <p className="text-[9px] font-bold text-slate-400 mt-1 leading-tight px-1">
                Ex: Para cadastrar o "Leito 02", selecione a "UTI Adulto" como pai.
              </p>
            </div>

            <button 
              type="submit" 
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md shadow-blue-100 transition-all active:scale-[0.98]"
            >
              💾 Cadastrar Localização
            </button>
          </form>
        </div>

        {/* TABELA DE VISUALIZAÇÃO HIERÁRQUICA */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Estrutura de Setores Cadastrados
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {setoresFiltrados.length} Registros
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-3">ID</th>
                  <th className="p-3">Hierarquia & Localização</th>
                  <th className="p-3 text-center">Tipo</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {setoresPaginados.map((setor) => {
                  const partes = setor.nome.split(" > ");
                  const isPrincipal = partes.length === 1;

                  return (
                    <tr key={setor.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-mono text-slate-400 font-bold">#{setor.id}</td>
                      
                      <td className="p-3 pr-2">
                        <div className="font-bold text-slate-700 tracking-tight uppercase flex flex-wrap items-center">
                          {partes.map((parte, index, arr) => (
                            <span key={index} className="inline-flex items-center">
                              {index > 0 && <span className="text-slate-300 font-normal mx-1.5">➔</span>}
                              <span className={index === arr.length - 1 ? "text-blue-600 font-black" : "text-slate-400 font-medium text-[11px]"}>
                                {parte}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          isPrincipal ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isPrincipal ? '🏢 Prédio' : '🚪 Sala/Subsetor'}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <Link
                          to={`/setores/${setor.id}/prontuario`}
                          className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border border-blue-100 active:scale-95 shadow-sm"
                          title="Abrir Prontuário do Setor"
                        >
                          📋 Prontuário
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {setoresFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-10 text-xs font-bold text-slate-400 italic">
                      Nenhum setor ou subsetor localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINAÇÃO */}
          {setoresFiltrados.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400">
                Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                  disabled={paginaAtual === 1}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default GestaoSetores;