'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, Clock, Sun, Moon, Home, BookOpen, Trophy, User, LogOut, Mail, Lock, ChromeIcon as Google, Apple } from 'lucide-react'
import { db, auth } from '@/lib/firebase'
import { collection, getDocs, query, orderBy, limit, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  updatePassword, 
  User as FirebaseUser,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface QuizQuestion {
  id: string;
  passage: string;
  options: { book: string; chapter: number; verse: number }[];
  correctAnswer: { book: string; chapter: number; verse: number };
  explanation: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  score: number;
}

export default function EnhancedBibleQuiz() {
  const [quizData, setQuizData] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState("")
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [isAnswered, setIsAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [leaderboard, setLeaderboard] = useState<User[]>([])
  const [playerName, setPlayerName] = useState("")
  const [playerEmail, setPlayerEmail] = useState("")
  const [currentScreen, setCurrentScreen] = useState("welcome")
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPassword, setNewPassword] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      const questionsSnapshot = await getDocs(collection(db, 'questions'))
      const fetchedQuestions = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizQuestion))
      setQuizData(fetchedQuestions)

      const leaderboardQuery = query(collection(db, 'users'), orderBy('score', 'desc'), limit(10))
      const leaderboardSnapshot = await getDocs(leaderboardQuery)
      const fetchedLeaderboard = leaderboardSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User))
      setLeaderboard(fetchedLeaderboard)
    }

    fetchData()

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user)
      if (user) {
        fetchUserData(user.uid)
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchUserData = async (userId: string) => {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      const userData = userDoc.data() as User
      setPlayerName(userData.name)
      setPlayerEmail(userData.email)
      setScore(userData.score)
    }
  }

  const handleSubmit = () => {
    const correctAnswer = quizData[currentQuestion].correctAnswer
    if (selectedAnswer === `${correctAnswer.book} ${correctAnswer.chapter}:${correctAnswer.verse}`) {
      setScore(score + 1)
    }
    setIsAnswered(true)
  }

  useEffect(() => {
    if (timeLeft > 0 && !isAnswered && currentScreen === "quiz") {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !isAnswered && currentScreen === "quiz") {
      handleSubmit()
    }
  }, [timeLeft, isAnswered, currentScreen, handleSubmit, quizData, currentQuestion, selectedAnswer, score])

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer)
  }


  const handleNextQuestion = () => {
    setSelectedAnswer("")
    setIsAnswered(false)
    setTimeLeft(60)
    if (currentQuestion < quizData.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      setShowResult(true)
      updateLeaderboard()
    }
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setSelectedAnswer("")
    setScore(0)
    setShowResult(false)
    setIsAnswered(false)
    setTimeLeft(60)
    setCurrentScreen("quiz")
  }

  const updateLeaderboard = async () => {
    if (!currentUser) return

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        score: score
      })

      const newLeaderboard = [...leaderboard, { id: currentUser.uid, name: playerName, email: playerEmail, score }]
      newLeaderboard.sort((a, b) => b.score - a.score)
      setLeaderboard(newLeaderboard.slice(0, 10))
    } catch (error) {
      console.error('Error updating leaderboard:', error)
      setErrorMessage('Failed to update leaderboard. Please try again.')
    }
  }

  const shareResults = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Bible Quiz Results',
        text: `I scored ${score} out of ${quizData.length} in the Bible Quiz! Can you beat my score?`,
        url: window.location.href,
      })
    } else {
      alert(`I scored ${score} out of ${quizData.length} in the Bible Quiz! Can you beat my score?`)
    }
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    try {
      await signInWithEmailAndPassword(auth, playerEmail, password)
      setCurrentScreen("quiz")
    } catch (error) {
      console.error('Error during login:', error)
      setErrorMessage('Invalid email or password. Please try again.')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, playerEmail, password)
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: playerName,
        email: playerEmail,
        score: 0
      })
      setCurrentScreen("quiz")
    } catch (error) {
      console.error('Error during registration:', error)
      setErrorMessage('Registration failed. This email might already be in use.')
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    try {
      await sendPasswordResetEmail(auth, playerEmail)
      setErrorMessage('Password reset email sent. Please check your inbox.')
    } catch (error) {
      console.error('Error sending password reset email:', error)
      setErrorMessage('Failed to send password reset email. Please try again.')
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setCurrentUser(null)
      setPlayerName("")
      setPlayerEmail("")
      setScore(0)
      setCurrentScreen("welcome")
    } catch (error) {
      console.error('Error signing out:', error)
      setErrorMessage('Failed to log out. Please try again.')
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!currentUser) return

    try {
      if (newName) {
        await updateDoc(doc(db, 'users', currentUser.uid), { name: newName })
        setPlayerName(newName)
      }
      if (newPassword) {
        await updatePassword(currentUser, newPassword)
      }
      setIsEditingProfile(false)
      setNewName('')
      setNewPassword('')
      setErrorMessage('Profile updated successfully.')
    } catch (error) {
      console.error('Error updating profile:', error)
      setErrorMessage('Failed to update profile. Please try again.')
    }
  }

  const handleSocialLogin = async (provider: GoogleAuthProvider | OAuthProvider) => {
    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName,
        email: user.email,
        score: 0
      }, { merge: true })
      setCurrentScreen("quiz")
    } catch (error) {
      console.error('Error during social login:', error)
      setErrorMessage('Failed to login. Please try again.')
    }
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 font-montserrat ${
      isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
    }`}>
      <header className="p-6 flex justify-between items-center border-b border-purple-200 dark:border-purple-800">
        <div>
          <p className="text-sm font-medium text-pink-600 dark:text-pink-400 uppercase tracking-wide">
            Bible Quiz
          </p>
          <h1 className="text-2xl font-bold mt-1 text-purple-800 dark:text-purple-300">
            {playerName || 'Welcome'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleDarkMode} 
            className={isDarkMode ? "text-purple-300" : "text-purple-600"}
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
          </Button>
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg" alt="Profile" />
                    <AvatarFallback>{playerName ? playerName[0].toUpperCase() : 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditingProfile(true)}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main className="flex-grow px-4 pb-24 pt-6">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentScreen === "welcome" && (
                <Card className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-4 text-purple-800 dark:text-purple-200">Welcome to Bible Quiz</h2>
                    {currentUser ? (
                      <div className="space-y-4">
                        <p className="text-purple-700 dark:text-purple-300">Welcome back, {playerName}!</p>
                        <Button 
                          onClick={() => setCurrentScreen("quiz")} 
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Start Quiz
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <form onSubmit={handleLogin} className="space-y-4">
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input 
                              type="email"
                              placeholder="Email"
                              value={playerEmail} 
                              onChange={(e) => setPlayerEmail(e.target.value)}
                              className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                            />
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input 
                              type="password"
                              placeholder="Password"
                              value={password} 
                              onChange={(e) => setPassword(e.target.value)}
                              className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                            />
                          </div>
                          {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
                          <Button 
                            type="submit"
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            Login
                          </Button>
                        </form>
                        <div className="flex justify-center space-x-4">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleSocialLogin(new GoogleAuthProvider())}
                            className="rounded-full"
                          >
                            <Google className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleSocialLogin(new OAuthProvider('apple.com'))}
                            className="rounded-full"
                          >
                            <Apple className="h-5 w-5" />
                          </Button>
                        </div>
                        <div className="flex justify-between">
                          <Button variant="link" onClick={() => setCurrentScreen("register")}>
                            Create Account
                          </Button>
                          <Button variant="link" onClick={() => setCurrentScreen("forgotPassword")}>
                            Forgot Password?
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {currentScreen === "register" && (
                <Card className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-4 text-purple-800 dark:text-purple-200">Create Account</h2>
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          placeholder="Name"
                          value={playerName} 
                          onChange={(e) => setPlayerName(e.target.value)}
                          className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                        />
                      </div>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          type="email"
                          placeholder="Email"
                          value={playerEmail} 
                          onChange={(e) => setPlayerEmail(e.target.value)}
                          className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          type="password"
                          placeholder="Password"
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          type="password"
                          placeholder="Confirm Password"
                          value={confirmPassword} 
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                        />
                      </div>
                      {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
                      <Button 
                        type="submit"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Register
                      </Button>
                    </form>
                    <Button variant="link" onClick={() => setCurrentScreen("welcome")} className="mt-4">
                      Back to Login
                    </Button>
                  </CardContent>
                </Card>
              )}

              {currentScreen === "forgotPassword" && (
                <Card className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-4 text-purple-800 dark:text-purple-200">Forgot Password</h2>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          type="email"
                          placeholder="Email"
                          value={playerEmail} 
                          onChange={(e) => setPlayerEmail(e.target.value)}
                          className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                        />
                      </div>
                      {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
                      <Button 
                        type="submit"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Reset Password
                      </Button>
                    </form>
                    <Button variant="link" onClick={() => setCurrentScreen("welcome")} className="mt-4">
                      Back to Login
                    </Button>
                  </CardContent>
                </Card>
              )}

              {isEditingProfile && (
                <Card className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-4 text-purple-800 dark:text-purple-200">Edit Profile</h2>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          placeholder="New Name"
                          value={newName} 
                          onChange={(e) => setNewName(e.target.value)}
                          className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input 
                          type="password"
                          placeholder="New Password"
                          value={newPassword} 
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                        />
                      </div>
                      {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
                      <Button 
                        type="submit"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Update Profile
                      </Button>
                    </form>
                    <Button variant="link" onClick={() => setIsEditingProfile(false)} className="mt-4">
                      Cancel
                    </Button>
                  </CardContent>
                </Card>
              )}

              {currentScreen === "quiz" && quizData.length > 0 && (
                <Card className="bg-white dark:bg-gray-800 shadow-lg">
                  <CardContent className="p-6">
                    {!showResult ? (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-xl font-semibold text-purple-800 dark:text-purple-200">
                            Question {currentQuestion + 1} of {quizData.length}
                          </h2>
                          <div className="flex items-center space-x-2 text-pink-600 dark:text-pink-400">
                            <Clock className="w-5 h-5" />
                            <span>{timeLeft}s</span>
                          </div>
                        </div>
                        <p className="mb-6 text-lg text-purple-700 dark:text-purple-300">{quizData[currentQuestion].passage}</p>
                        <RadioGroup value={selectedAnswer} onValueChange={handleAnswerSelect} className="space-y-2">
                          {quizData[currentQuestion].options.map((option, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <RadioGroupItem
                                value={`${option.book} ${option.chapter}:${option.verse}`}
                                id={`option-${index}`}
                                disabled={isAnswered}
                                className="border-purple-400 text-purple-600"
                              />
                              <Label htmlFor={`option-${index}`} className="cursor-pointer text-purple-700 dark:text-purple-300">
                                {option.book} {option.chapter}:{option.verse}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        {isAnswered && (
                          <div className="mt-4">
                            <p className={`font-semibold ${selectedAnswer === `${quizData[currentQuestion].correctAnswer.book} ${quizData[currentQuestion].correctAnswer.chapter}:${quizData[currentQuestion].correctAnswer.verse}` ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {selectedAnswer === `${quizData[currentQuestion].correctAnswer.book} ${quizData[currentQuestion].correctAnswer.chapter}:${quizData[currentQuestion].correctAnswer.verse}` ? 'Correct!' : `Incorrect. The correct answer is ${quizData[currentQuestion].correctAnswer.book} ${quizData[currentQuestion].correctAnswer.chapter}:${quizData[currentQuestion].correctAnswer.verse}`}
                            </p>
                            <p className="mt-2 text-purple-700 dark:text-purple-300">{quizData[currentQuestion].explanation}</p>
                          </div>
                        )}
                        <div className="mt-6 flex justify-center">
                          {isAnswered ? (
                            <Button onClick={handleNextQuestion} className="bg-purple-600 text-white hover:bg-purple-700">
                              {currentQuestion < quizData.length - 1 ? 'Next Question' : 'Finish Quiz'}
                            </Button>
                          ) : (
                            <Button onClick={handleSubmit} disabled={!selectedAnswer} className="bg-purple-600 text-white hover:bg-purple-700">
                              Submit Answer
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4 text-purple-800 dark:text-purple-200">Quiz Completed!</h2>
                        <p className="text-xl mb-4 text-purple-700 dark:text-purple-300">Your score: {score} out of {quizData.length}</p>
                        <div className="flex justify-center gap-4">
                          <Button onClick={shareResults} className="bg-pink-600 text-white hover:bg-pink-700">
                            <Share2 className="w-4 h-4 mr-2" />
                            Share Results
                          </Button>
                          <Button onClick={resetQuiz} className="bg-purple-600 text-white hover:bg-purple-700">
                            Restart Quiz
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {currentScreen === "leaderboard" && (
                <Card className="bg-white dark:bg-gray-800 shadow-lg">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-6 text-purple-800 dark:text-purple-200">Leaderboard</h2>
                    <div className="space-y-4">
                      {leaderboard.map((user, index) => (
                        <div 
                          key={user.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <span className="font-medium text-purple-800 dark:text-purple-200">{user.name}</span>
                          </div>
                          <span className="font-bold text-pink-600 dark:text-pink-400">{user.score} pts</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {currentUser && (
        <footer className={`fixed bottom-0 left-0 right-0 ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        } border-t border-purple-200 dark:border-purple-800`}>
          <nav className="max-w-2xl mx-auto px-6 py-4">
            <div className="flex justify-around items-center">
              <Button
                variant="ghost"
                onClick={() => setCurrentScreen("welcome")}
                className={`flex flex-col items-center gap-1 h-auto px-6 ${
                  currentScreen === "welcome" 
                    ? "text-purple-600 dark:text-purple-400" 
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                <Home className="h-7 w-7" />
                <span className="text-xs font-medium">Home</span>
              </Button>

              <Button
                variant="ghost"
                onClick={() => setCurrentScreen("quiz")}
                className={`flex flex-col items-center gap-1 h-auto px-6 ${
                  currentScreen === "quiz" 
                    ? "text-purple-600 dark:text-purple-400" 
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                <BookOpen className="h-7 w-7" />
                <span className="text-xs font-medium">Quiz</span>
              </Button>

              <Button
                variant="ghost"
                onClick={() => setCurrentScreen("leaderboard")}
                className={`flex flex-col items-center gap-1 h-auto px-6 ${
                  currentScreen === "leaderboard" 
                    ? "text-purple-600 dark:text-purple-400" 
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                <Trophy className="h-7 w-7" />
                <span className="text-xs font-medium">Ranks</span>
              </Button>
            </div>
          </nav>
        </footer>
      )}
    </div>
  )
}