async function check() {
  try {
    const res = await fetch('http://localhost:3000/api/plugins');
    const data = await res.json();
    console.log('Server is running on port 3000! Plugins count:', data.plugins ? data.plugins.length : 'unknown');
  } catch(e) {
    console.log('Server is not running on port 3000:', e.message);
  }
}
check();
