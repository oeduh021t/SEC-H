import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function ImprimirOrcamentoExterno() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  
  // 🔒 Trava para impedir que o diálogo de impressão reabra em loop
  const impressaoDisparada = useRef(false);

  useEffect(() => {
    let nivel = 'admin';
    try {
      const salvo = localStorage.getItem('user');
      if (salvo) {
        const u = JSON.parse(salvo);
        nivel = (u.nivel || u.cargo || u.role || 'admin').toLowerCase().trim();
      }
    } catch (e) {
      console.error(e);
    }

    fetch(`/api/orcamentos-externos/${id}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': nivel
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setDados(data);
        
        // Dispara apenas UMA única vez após carregar os dados
        if (!impressaoDisparada.current) {
          impressaoDisparada.current = true;
          setTimeout(() => {
            window.print();
          }, 400);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar orçamento:', err);
        setErro(err.message);
      });
  }, [id]);

  // Função inteligente para o botão Voltar
  const handleVoltar = () => {
    // Se a aba foi aberta diretamente via target="_blank"
    if (window.history.length <= 1) {
      window.close();
      // Fallback caso o navegador bloqueie o window.close()
      navigate('/orcamentos-externos');
    } else {
      navigate(-1);
    }
  };

  if (erro) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        Falha ao carregar orçamento: {erro}
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="p-8 text-center font-bold text-slate-500 animate-pulse">
        Carregando espelho do orçamento...
      </div>
    );
  }

  const { orcamento, itens } = dados;

  return (
    <div className="bg-slate-100 min-h-screen p-4 sm:p-8 font-sans">
      
      {/* 🖨️ REGRAS DE ISOLAMENTO TOTAL PARA IMPRESSÃO (A4) */}
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden !important;
          }

          #folha-orcamento-impressao,
          #folha-orcamento-impressao * {
            visibility: visible !important;
          }

          #folha-orcamento-impressao {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            min-height: 98vh !important;
          }

          .no-print {
            display: none !important;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>

      {/* Barra de Ações Superior (Apenas Tela) */}
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center no-print">
        <button
          type="button"
          onClick={handleVoltar}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 active:scale-95"
        >
          ← Voltar / Fechar
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          <span>🖨️</span> Imprimir / Salvar PDF
        </button>
      </div>

      {/* 📄 CONTAINER ISOLADO DE IMPRESSÃO */}
      <div 
        id="folha-orcamento-impressao" 
        className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-slate-900 flex flex-col justify-between"
      >
        <div>
          {/* Cabeçalho */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">
                Clínica Materno-Infantil Domingos Lourenço
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                Setor de Engenharia Clínica & Manutenção Predial / Infraestrutura
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-black border border-slate-900 px-2 py-0.5 rounded inline-block bg-slate-50">
                {orcamento.codigo_orcamento}
              </span>
              <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase">
                Data: {new Date(orcamento.data_emissao).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Dados do Destinatário e Prestador */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-[11px] space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div><strong>Destinatário:</strong> Departamento Financeiro / Contas a Pagar</div>
              <div><strong>Prestador:</strong> {orcamento.fornecedor_nome || 'Oficina Homologada'}</div>
              <div><strong>CNPJ:</strong> {orcamento.cnpj || 'Não informado'}</div>
              <div><strong>Telefone:</strong> {orcamento.telefone || 'Não informado'}</div>
            </div>
            {orcamento.observacoes && (
              <p className="text-[10px] text-slate-600 italic border-t border-slate-200 pt-1 mt-1">
                <strong>Obs:</strong> {orcamento.observacoes}
              </p>
            )}
          </div>

          {/* Tabela de Itens e Subtotais */}
          <table className="w-full text-left text-[11px] border-collapse border border-slate-300 mb-4">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[9px] tracking-wider">
                <th className="p-2 border border-slate-900 w-[30%]">Ativo / Equipamento</th>
                <th className="p-2 border border-slate-900 text-center w-[12%]">OS</th>
                <th className="p-2 border border-slate-900 w-[43%]">Serviços e Peças Discriminadas</th>
                <th className="p-2 border border-slate-900 text-right w-[15%]">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {itens.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="p-2 border border-slate-300 font-bold text-slate-800">
                    {item.equipamento_nome || 'Equipamento'}
                    <span className="block text-[9px] font-normal text-slate-500 mt-0.5">
                      Pat: {item.patrimonio || 'S/P'} | S/N: {item.num_serie || 'N/A'}
                    </span>
                    <span className="block text-[9px] font-normal text-slate-400">
                      Setor: {item.setor_nome || 'Manutenção'}
                    </span>
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-black text-blue-600">
                    #{item.chamado_id}
                  </td>
                  <td className="p-2 border border-slate-300 whitespace-pre-wrap leading-relaxed text-slate-700">
                    {item.descricao_proposta}
                  </td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-bold text-slate-900">
                    R$ {Number(item.valor_unitario).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black text-xs">
                <td colSpan="3" className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                  Valor Total do Lote:
                </td>
                <td className="p-2.5 border border-slate-300 text-right font-mono text-blue-900 text-sm">
                  R$ {Number(orcamento.valor_total).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Instrução ao Financeiro */}
          <div className="text-[10px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-6 leading-relaxed">
            <p className="font-bold text-slate-800 uppercase text-[9px] mb-0.5">Instrução Contábil & Rateio Financeiro:</p>
            Os valores acima foram negociados em lote único com a assistência. Caso seja emitida Nota Fiscal consolidada no valor total de <strong>R$ {Number(orcamento.valor_total).toFixed(2)}</strong>, o montante deve ser apropriado proporcionalmente nos centros de custos das respectivas Ordens de Serviço para fins de auditoria e prontuário dos ativos.
          </div>
        </div>

        {/* Linhas de Assinatura */}
        <div className="grid grid-cols-2 gap-12 text-center pt-6 text-[10px] border-t border-slate-300">
          <div>
            <p className="border-t border-slate-800 pt-1 font-bold text-slate-800 uppercase">
              Engenharia Clínica & Manutenção
            </p>
            <p className="text-[8px] text-slate-400 uppercase font-semibold">Responsável Técnico / Emissor</p>
          </div>
          <div>
            <p className="border-t border-slate-800 pt-1 font-bold text-slate-800 uppercase">
              Departamento Financeiro / Diretoria
            </p>
            <p className="text-[8px] text-slate-400 uppercase font-semibold">Validação & Baixa Fiscal</p>
          </div>
        </div>

      </div>
    </div>
  );
}