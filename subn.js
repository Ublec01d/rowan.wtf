// Subnetting Quiz Logic

function ipToBinary(ip) {
    return ip.split('.').map(octet => parseInt(octet, 10).toString(2).padStart(8, '0')).join('');
  }
  
  function binaryToIp(binary) {
    return binary.match(/.{1,8}/g).map(bin => parseInt(bin, 2)).join('.');
  }
  
  function calculateNetworkAndBroadcast(ip, cidr) {
    const binaryIp = ipToBinary(ip);
    const networkBinary = binaryIp.slice(0, cidr).padEnd(32, '0');
    const broadcastBinary = binaryIp.slice(0, cidr).padEnd(32, '1');
    return {
      network: binaryToIp(networkBinary),
      broadcast: binaryToIp(broadcastBinary)
    };
  }
  
  function generateQuestion() {
    const ipParts = Array.from({ length: 4 }, () => Math.floor(Math.random() * 256));
    const ip = ipParts.join('.');
    const cidr = Math.floor(Math.random() * 13) + 16; // CIDR between /16 and /29
  
    const subnetMask = ("1".repeat(cidr) + "0".repeat(32 - cidr))
      .match(/.{1,8}/g)
      .map(bin => parseInt(bin, 2))
      .join('.');
  
    const subnetBits = 2 ** (32 - cidr);
    const { network, broadcast } = calculateNetworkAndBroadcast(ip, cidr);
  
    correctSubnetMask = subnetMask;
    correctTotalAddresses = subnetBits.toString();
    correctNetworkAddress = network;
    correctBroadcastAddress = broadcast;
  
    document.getElementById('question').textContent = `What are the subnet mask, total number of hosts, network address, and broadcast address for ${ip} /${cidr}?`;
  
    // Clear the input fields
    document.getElementById('subnetMaskAnswer').value = '';
    document.getElementById('totalAddressesAnswer').value = '';
    document.getElementById('networkAddressAnswer').value = '';
    document.getElementById('broadcastAddressAnswer').value = '';
  }
  
  function checkAnswer() {
    const subnetMaskAnswer = document.getElementById('subnetMaskAnswer').value.trim();
    const totalAddressesAnswer = document.getElementById('totalAddressesAnswer').value.trim();
    const networkAddressAnswer = document.getElementById('networkAddressAnswer').value.trim();
    const broadcastAddressAnswer = document.getElementById('broadcastAddressAnswer').value.trim();
  
    if (
      subnetMaskAnswer === correctSubnetMask &&
      totalAddressesAnswer === correctTotalAddresses &&
      networkAddressAnswer === correctNetworkAddress &&
      broadcastAddressAnswer === correctBroadcastAddress
    ) {
      document.getElementById('result').textContent = '✅ Correct!';
      document.getElementById('result').style.color = 'lime';
    } else {
      document.getElementById('result').textContent = `❌ Incorrect! Correct answers: Subnet Mask: ${correctSubnetMask}, Total num of Hosts: ${correctTotalAddresses}, Network Address: ${correctNetworkAddress}, Broadcast Address: ${correctBroadcastAddress}`;
      document.getElementById('result').style.color = 'red';
    }
    setTimeout(() => {
      document.getElementById('result').textContent = '';
      generateQuestion();
    }, 10000);
  }
  
  // Variables for correct answers
  let correctSubnetMask = '';
  let correctTotalAddresses = '';
  let correctNetworkAddress = '';
  let correctBroadcastAddress = '';
  
  // Initialize the first question
  generateQuestion();
  
