async function fetchIpAddress() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      document.getElementById('ip-address').textContent = data.ip;
    } catch (error) {
      document.getElementById('ip-address').textContent = 'Error fetching IP';
      console.error('Error fetching IP address:', error);
    }
  }

  // Call the function to load the IP address when the page loads
  window.onload = fetchIpAddress;