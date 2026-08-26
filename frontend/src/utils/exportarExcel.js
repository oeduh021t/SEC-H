// src/utils/exportarExcel.js
export const baixarRelatorioExcel = async (tipoRelatorio, nomeArquivo) => {
  const API_URL = 'http://192.168.5.101:3000/api';
  const savedUser = localStorage.getItem('user');
  const user = savedUser ? JSON.parse(savedUser) : null;

  try {
    const response = await fetch(`${API_URL}/relatorios/exportar/${tipoRelatorio}`, {
      headers: {
        'x-usuario-nivel': user?.nivel || ''
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Falha ao gerar planilha.');
    }

    // Converte a resposta binária em arquivo para download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nomeArquivo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Erro ao exportar planilha Excel: ' + err.message);
  }
};