import './App.css';
import axios from 'axios';

const apiCall = () => {
  window.location.href = 'http://localhost:8080/login'
}
function App() {
  return (
    <div className="App">
      <p> Test for spotify api</p>
      <button onClick={apiCall}> make call</button>
    </div>
  )
}

export default App;
