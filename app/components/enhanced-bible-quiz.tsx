'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, Clock, Sun, Moon, Home, BookOpen, Trophy, User, AlertCircle, RefreshCw, X } from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, orderBy, limit, setDoc, doc, where } from 'firebase/firestore'
import { Alert, AlertDescription } from "@/components/ui/alert"

interface QuizQuestion {
  id: string;
  category: string;
  passage?: string;
  question: string;
  options: { book: string; chapter: number; verse: number }[];
  correctAnswer: { book: string; chapter: number; verse: number };
  explanation: string;
}

interface User {
  id: string;
  name: string;
  score: number;
}

const quizCategories = [
  "Passage/Memory verses",
  "Bible Characters",
  "Places & Location",
  "General Knowledge"
]

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function EnhancedBibleQuiz() {
  const [quizData, setQuizData] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState("")
  const [score, setScore] = useState(0)
  const [isAnswered, setIsAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [leaderboard, setLeaderboard] = useState<User[]>([])
  const [playerName, setPlayerName] = useState("")
  const [currentScreen, setCurrentScreen] = useState("welcome")
  const [errorMessage, setErrorMessage] = useState("")
  const [isClient, setIsClient] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

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

  const fetchQuizData = useCallback(async (category: string) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const questionsQuery = query(collection(db, 'questions'), where('category', '==', category));
      const questionsSnapshot = await getDocs(questionsQuery);
      const fetchedQuestions = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizQuestion));
      const shuffledQuestions = shuffleArray(fetchedQuestions).map(question => ({
        ...question,
        options: shuffleArray(question.options)
      }));
      setQuizData(shuffledQuestions);
      if (shuffledQuestions.length === 0) {
        setErrorMessage('No questions available for this category. Please try again later.');
      }
    } catch (error) {
      console.error('Error fetching quiz data:', error);
      setErrorMessage('Failed to load quiz questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const leaderboardQuery = query(collection(db, 'users'), orderBy('score', 'desc'), limit(10));
      const leaderboardSnapshot = await getDocs(leaderboardQuery);
      const fetchedLeaderboard = leaderboardSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name, 
        score: doc.data().score 
      }));
      setLeaderboard(fetchedLeaderboard);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setErrorMessage('Failed to load leaderboard. Please try again.');
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      fetchLeaderboard()
    }
  }, [isClient, fetchLeaderboard])

  const savePlayerName = (name: string) => {
    setPlayerName(name)
    localStorage.setItem('playerName', name)
  }

  const handleSubmit = useCallback(() => {
    if (selectedAnswer) {
      const parsedAnswer = JSON.parse(selectedAnswer);
      const correctAnswer = quizData[currentQuestion].correctAnswer;
      if (
        parsedAnswer.book === correctAnswer.book &&
        parsedAnswer.chapter === correctAnswer.chapter &&
        parsedAnswer.verse === correctAnswer.verse
      ) {
        setScore(prevScore => prevScore + 1)
      }
    }
    setIsAnswered(true)
  }, [quizData, currentQuestion, selectedAnswer])

  useEffect(() => {
    if (timeLeft > 0 && !isAnswered && currentScreen === "quiz") {
      const timer = setTimeout(() => setTimeLeft(prevTime => prevTime - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !isAnswered && currentScreen === "quiz") {
      handleSubmit()
      if (currentQuestion === quizData.length - 1) {
        updateLeaderboard()
        setShowResults(true)
        setCurrentScreen("results")
      } else {
        handleNextQuestion()
      }
    }
  }, [timeLeft, isAnswered, currentScreen, handleSubmit, currentQuestion, quizData.length])

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
      updateLeaderboard()
      setShowResults(true)
      setCurrentScreen("results") 
    }
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setSelectedAnswer("")
    setScore(0)
    setIsAnswered(false)
    setTimeLeft(60)
    setSelectedCategory("")
    setCurrentScreen("category")
    setShowResults(false)
  }

  const updateLeaderboard = async () => {
    try {
      const userId = localStorage.getItem('userId') || Date.now().toString();
      localStorage.setItem('userId', userId);
      
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        name: playerName,
        score: score
      }, { merge: true });
      
      localStorage.setItem('playerScore', score.toString());
      
      fetchLeaderboard();
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      setErrorMessage('Failed to update leaderboard. Please try again.');
    }
  }

  const shareResults = () => {
    const text = `I scored ${score} out of ${quizData.length} in the ${selectedCategory} Bible Quiz! Can you beat my score?`;
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: 'Bible Quiz Results',
        text: text,
        url: url,
      }).catch((error) => console.log('Error sharing', error));
    } else {
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(shareUrl, '_blank');
    }
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  const handleScreenChange = (screen: string) => {
    if (screen === "quiz") {
      if (!playerName.trim()) {
        setErrorMessage("Please enter your name before starting the quiz.")
        setCurrentScreen("welcome")
      } else {
        setCurrentScreen("category")
      }
    } else {
      setCurrentScreen(screen)
    }
  }

  const startQuiz = async (category: string) => {
    if (category === "Passage/Memory verses") {
      setSelectedCategory(category);
      await fetchQuizData(category);
      if (quizData.length > 0) {
        setCurrentScreen("quiz");
      }
    }
  };

  const cancelQuiz = () => {
    setCurrentScreen("welcome")
    resetQuiz()
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
                          onClick={() => setCurrentScreen("category")} 
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Start Quiz
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={(e) => {
                        e.preventDefault()
                        const formData = new FormData(e.currentTarget)
                        const name = formData.get('playerName') as string
                        if (name.trim()) {
                          savePlayerName(name.trim())
                          setCurrentScreen("category")
                        }
                      }} className="space-y-4">
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <Input 
                            name="playerName"
                            placeholder="Enter your name"
                            defaultValue={playerName}
                            className="pl-10 bg-white/50 dark:bg-gray-800/50 border-purple-300 dark:border-purple-700"
                          />
                        </div>
                        <Button 
                          type="submit"
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Start Quiz
                        </Button>
                      </form>
                    )}
                    {errorMessage && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {currentScreen === "category" && (
                <Card className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-4 text-purple-800 dark:text-purple-200">Choose a Category</h2>
                    <div className="space-y-4">
                      {quizCategories.map((category) => (
                        <Button 
                          key={category}
                          onClick={() => category === "Passage/Memory verses" ? startQuiz(category) : null} 
                          className={`w-full ${
                            category === "Passage/Memory verses"
                              ? "bg-purple-600 hover:bg-purple-700 text-white"
                              : "bg-gray-400 text-gray-700 cursor-not-allowed"
                          }`}
                          disabled={category !== "Passage/Memory verses"}
                        >
                          {category === "Passage/Memory verses" ? category : `${category} (Coming Soon)`}
                        </Button>
                      ))}
                    </div>
                    {errorMessage && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {currentScreen === "quiz" && (
                <Card className="bg-white dark:bg-gray-800 shadow-lg">
                  <CardContent className="p-6">
                    {isLoading ? (
                      <div className="text-center">
                        <p className="text-lg text-purple-700 dark:text-purple-300">Loading questions...</p>
                      </div>
                    ) : quizData.length > 0 ? (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-xl font-semibold text-purple-800 dark:text-purple-200">
                            {selectedCategory}: Question {currentQuestion + 1} of {quizData.length}
                          </h2>
                          <div className="flex items-center space-x-2 text-pink-600 dark:text-pink-400">
                            <Clock className="w-5 h-5" />
                            <span>{timeLeft}s</span>
                          </div>
                        </div>
                        <p className="mb-6 text-lg text-purple-700 dark:text-purple-300">
                          {quizData[currentQuestion].passage && `${quizData[currentQuestion].passage}: `}
                          {quizData[currentQuestion].question}
                        </p>
                        <RadioGroup value={selectedAnswer} onValueChange={handleAnswerSelect} className="space-y-2">
                          {quizData[currentQuestion].options.map((option, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <RadioGroupItem
                                value={JSON.stringify(option)}
                                id={`option-${index}`}
                                disabled={isAnswered}
                                className="border-purple-400 text-purple-600"
                              />
                              <Label htmlFor={`option-${index}`} className="cursor-pointer text-purple-700 dark:text-purple-300">
                                {`${option.book} ${option.chapter}:${option.verse}`}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        {isAnswered && (
                          <div className="mt-4">
                            <p className={`font-semibold ${
                              JSON.parse(selectedAnswer).book === quizData[currentQuestion].correctAnswer.book &&
                              JSON.parse(selectedAnswer).chapter === quizData[currentQuestion].correctAnswer.chapter &&
                              JSON.parse(selectedAnswer).verse === quizData[currentQuestion].correctAnswer.verse
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {JSON.parse(selectedAnswer).book === quizData[currentQuestion].correctAnswer.book &&
                               JSON.parse(selectedAnswer).chapter === quizData[currentQuestion].correctAnswer.chapter &&
                               JSON.parse(selectedAnswer).verse === quizData[currentQuestion].correctAnswer.verse
                                ? 'Correct!'
                                : `Incorrect. The correct answer is ${quizData[currentQuestion].correctAnswer.book} ${quizData[currentQuestion].correctAnswer.chapter}:${quizData[currentQuestion].correctAnswer.verse}`
                              }
                            </p>
                            <p className="mt-2 text-purple-700 dark:text-purple-300">{quizData[currentQuestion].explanation}</p>
                          </div>
                        )}
                        <div className="mt-6 flex justify-between">
                          <Button onClick={cancelQuiz} className="bg-red-600 text-white hover:bg-red-700">
                            <X className="mr-2 h-4 w-4" /> Cancel Quiz
                          </Button>
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
                        <p className="text-lg text-purple-700 dark:text-purple-300">No questions available for this category. Please try again later.</p>
                        <Button onClick={() => setCurrentScreen("category")} className="mt-4 bg-purple-600 text-white hover:bg-purple-700">
                          Back to Categories
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {currentScreen === "results" && (
                <Card className="bg-white dark:bg-gray-800 shadow-lg">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-4 text-purple-800 dark:text-purple-200">Quiz Results</h2>
                    <div className="text-center mb-6">
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {score} / {quizData.length}
                      </p>
                      <p className="text-lg text-purple-700 dark:text-purple-300 mt-2">
                        Great job, {playerName}!
                      </p>
                    </div>
                    <div className="space-y-4">
                      <Button 
                        onClick={shareResults} 
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Share2 className="mr-2 h-4 w-4" /> Share Results
                      </Button>
                      <Button 
                        onClick={() => {
                          setCurrentScreen("leaderboard")
                          setShowResults(false)
                        }} 
                        className="w-full bg-pink-600 hover:bg-pink-700 text-white"
                      >
                        <Trophy className="mr-2 h-4 w-4" /> View Leaderboard
                      </Button>
                      <Button 
                        onClick={resetQuiz} 
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" /> Restart Quiz
                      </Button>
                    </div>
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
                    <Button 
                      onClick={() => {
                        setCurrentScreen("welcome")
                        setShowResults(false)
                      }} 
                      className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Back to Home
                    </Button>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className={`fixed bottom-0 left-0 right-0 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      } border-t border-purple-200 dark:border-purple-800`}>
        <nav className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex justify-around items-center">
            <Button
              variant="ghost"
              onClick={() => handleScreenChange("welcome")}
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
              onClick={() => handleScreenChange("quiz")}
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
              onClick={() => handleScreenChange("leaderboard")}
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
    </div>
  )
}