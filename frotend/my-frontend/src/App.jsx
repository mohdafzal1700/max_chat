import Login from './Auth/login'
import Signin from './Auth/register'
import { ChatContainer } from './pages/chat-container'
import UserListingPage from './pages/user-listing-page'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Signin />} />
        <Route path='/userList' element={<UserListingPage/>}/>
        <Route path='/Chat' element={<ChatContainer/>}/>
      </Routes>
    </Router>
  )
}

export default App
