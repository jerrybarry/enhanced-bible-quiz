'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, Clock, Sun, Moon, Home, BookOpen, Trophy, User } from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, orderBy, limit, addDoc, updateDoc, doc } from 'firebase/firestore'

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
  const [currentScreen, setCurrentScreen] = useState("welcome")
  const [errorMessage, setErrorMessage] = useState("")
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const storedDarkMode = localStorage.getItem('isDarkMode')
    if (storedDarkMode !== null) {
      setIsDarkMode(storedDarkMode === 'true')
    }
    const storedPlayerName = localStorage.getItem('playerName')
    if (storedPlayerName) {
      setPlayerName(storedPlayerName)
    }
  }, [])

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('isDarkMode', isDarkMode.toString())
    }
  }, [isDarkMode, isClient])

  const fetchQuizData = useCallback(async () => {
    try {
      const questionsSnapshot = await getDocs(collection(db, 'questions'))
      const fetchedQuestions = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizQuestion))
      setQuizData(fetchedQuestions)
    } catch (error) {
      console.error('Error fetching quiz data:', error)
      setErrorMessage('Failed to load quiz questions. Please try again.')
    }
  }, [])

  const fetchLeaderboard = useCallback(async () => {
    try {
      const leaderboardQuery = query(collection(db, 'users'), orderBy('score', 'desc'), limit(10))
      const leaderboardSnapshot = await getDocs(leaderboardQuery)
      const fetchedLeaderboard = leaderboardSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User))
      setLeaderboard(fetchedLeaderboard)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setErrorMessage('Failed to load leaderboard. Please try again.')
    }
  }, [])

  useEffect(() => {
    if (isClient) {
      fetchQuizData()
      fetchLeaderboard()
    }
  }, [isClient, fetchQuizData, fetchLeaderboard])

  const savePlayerName = (name: string) => {
    setPlayerName(name)
    localStorage.setItem('playerName', name)
  }

  const handleSubmit = useCallback(() => {
    const correctAnswer = quizData[currentQuestion].correctAnswer
    if (selectedAnswer === `${correctAnswer.book} ${correctAnswer.chapter}:${correctAnswer.verse}`) {
      setScore(prevScore => prevScore + 1)
    }
    setIsAnswered(true)
  }, [quizData, currentQuestion, selectedAnswer])

  useEffect(() => {
    if (timeLeft > 0 && !isAnswered && currentScreen === "quiz") {
      const timer = setTimeout(() => setTimeLeft(prevTime => prevTime - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !isAnswered && currentScreen === "quiz") {
      handleSubmit()
    }
  }, [timeLeft, isAnswered, currentScreen, handleSubmit])

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
    try {
      const userRef = doc(db, 'users', playerName)
      await updateDoc(userRef, { score: score })
      
      const newLeaderboard = [...leaderboard, { id: playerName, name: playerName, score }]
      newLeaderboard.sort((a, b) => b.score - a.score)
      setLeaderboard(newLeaderboard.slice(0, 10))
      
      fetchLeaderboard()
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

  if (!isClient) {
    return null
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
          {playerName && (
            <Avatar className="h-8 w-8">
              <AvatarImage src="/placeholder.svg" alt="Profile" />
              <AvatarFallback>{playerName[0].toUpperCase()}</AvatarFallback>
            </Avatar>
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
                    {playerName ? (
                      <div className="space-y-4">
                        <p className="text-purple-700 dark:text-purple-300">Welcome back, {playerName}!</p>
                        <Button 
                          onClick={resetQuiz} 
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Start Quiz
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={(e) => {
                        e.preventDefault()
                        if (playerName.trim()) {
                          savePlayerName(playerName.trim())
                          setCurrentScreen("quiz")
                        }
                      }} className="space-y-4">
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <Input 
                            placeholder="Enter your name"
                            value={playerName} 
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                          />
                        </div>
                        <Button 
                          type="submit"
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          disabled={!playerName.trim()}
                        >
                          Start Quiz
                        </Button>
                      </form>
                    )}
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

      {playerName && (
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