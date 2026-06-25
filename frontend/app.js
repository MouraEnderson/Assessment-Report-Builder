const statusElement = document.getElementById('backend-status');
const checkButton = document.getElementById('check-health');

async function checkHealth() {
  statusElement.textContent = 'Verificando backend...';

  try {
    const response = await fetch('/health');
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || 'Backend respondeu com erro.');
    }

    statusElement.textContent = `Online: ${data.service} v${data.version}`;
  } catch (error) {
    statusElement.textContent = `Falha ao verificar backend: ${error.message}`;
  }
}

checkButton.addEventListener('click', checkHealth);
checkHealth();
