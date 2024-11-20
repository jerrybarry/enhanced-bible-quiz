'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LayoutDashboard, BookOpen, Users, Settings, LogOut, Plus, Trash2, Edit, AlertCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { db, auth } from '@/lib/firebase'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore'
import { signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth'

interface QuizQuestion {
  id: string
  category: string;
  passage: string
  options: { book: string; chapter: number; verse: number }[]
  correctAnswer: { book: string; chapter: number; verse: number }
  explanation: string
}

interface User {
  id: string
  name: string
  email: string
  score: number
}

export default function AdminPanel() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [activeUsers, setActiveUsers] = useState(0)
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [jsonInput, setJsonInput] = useState('')

  const [newQuestion, setNewQuestion] = useState<Omit<QuizQuestion, 'id'>>({
    category: '',
    passage: '',
    options: [
      { book: '', chapter: 0, verse: 0 },
      { book: '', chapter: 0, verse: 0 },
      { book: '', chapter: 0, verse: 0 },
      { book: '', chapter: 0, verse: 0 },
    ],
    correctAnswer: { book: '', chapter: 0, verse: 0 },
    explanation: '',
  })

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user)
      if (user) {
        fetchData()
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const questionsSnapshot = await getDocs(collection(db, 'questions'))
      const fetchedQuestions = questionsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as QuizQuestion))
      setQuestions(fetchedQuestions)

      const usersSnapshot = await getDocs(collection(db, 'users'))
      const fetchedUsers = usersSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as User))
      setUsers(fetchedUsers)

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const activeUsersQuery = query(
        collection(db, 'users'), 
        where('lastActive', '>', twentyFourHoursAgo)
      )
      const activeUsersSnapshot = await getDocs(activeUsersQuery)
      setActiveUsers(activeUsersSnapshot.size)
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error('Error signing in:', error)
      setError('Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
      setError('Failed to sign out')
    }
  }

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    setIsLoading(true)
    try {
      const docRef = await addDoc(collection(db, 'questions'), newQuestion)
      setQuestions([...questions, { ...newQuestion, id: docRef.id }])
      setNewQuestion({
        category: '',
        passage: '',
        options: [
          { book: '', chapter: 0, verse: 0 },
          { book: '', chapter: 0, verse: 0 },
          { book: '', chapter: 0, verse: 0 },
          { book: '', chapter: 0, verse: 0 },
        ],
        correctAnswer: { book: '', chapter: 0, verse: 0 },
        explanation: '',
      })
    } catch (error) {
      console.error('Error adding question:', error)
      setError('Failed to add question')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !editingQuestion) return

    setIsLoading(true)
    try {
      const { id, ...questionData } = editingQuestion
      await updateDoc(doc(db, 'questions', id), questionData)
      setQuestions(questions.map(q => q.id === id ? editingQuestion : q))
      setEditingQuestion(null)
    } catch (error) {
      console.error('Error updating question:', error)
      setError('Failed to update question')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!currentUser) return

    setIsLoading(true)
    try {
      await deleteDoc(doc(db, 'questions', id))
      setQuestions(questions.filter(q => q.id !== id))
    } catch (error) {
      console.error('Error deleting question:', error)
      setError('Failed to delete question')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    setIsLoading(true)
    try {
      const questionsToImport = JSON.parse(jsonInput)
      if (!Array.isArray(questionsToImport)) {
        throw new Error('Invalid JSON format')
      }

      const addedQuestions = await Promise.all(
        questionsToImport.map(async (question) => {
          const docRef = await addDoc(collection(db, 'questions'), question)
          return { ...question, id: docRef.id }
        })
      )

      setQuestions([...questions, ...addedQuestions])
      setJsonInput('')
    } catch (error) {
      console.error('Error importing questions:', error)
      setError('Failed to import questions. Please check your JSON format.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r">
        <div className="p-6">
          <h1 className="text-xl font-semibold">Admin Panel</h1>
        </div>
        <nav className="flex-1">
          <Tabs value={activeTab} className="w-full">
            <TabsList className="flex flex-col w-full rounded-none border-none gap-2 p-2">
              <TabsTrigger
                value="dashboard"
                className="w-full justify-start gap-2"
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="questions"
                className="w-full justify-start gap-2"
                onClick={() => setActiveTab('questions')}
              >
                <BookOpen className="h-4 w-4" />
                Questions
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="w-full justify-start gap-2"
                onClick={() => setActiveTab('users')}
              >
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="w-full justify-start gap-2"
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>
        <div className="p-6 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <LayoutDashboard className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="p-6">
            <SheetTitle>Admin Panel</SheetTitle>
          </SheetHeader>
          <nav className="flex-1">
            <Tabs value={activeTab} className="w-full">
              <TabsList className="flex flex-col w-full rounded-none border-none gap-2 p-2">
                <TabsTrigger
                  value="dashboard"
                  className="w-full justify-start gap-2"
                  onClick={() => setActiveTab('dashboard')}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger
                  value="questions"
                  className="w-full justify-start gap-2"
                  onClick={() => setActiveTab('questions')}
                >
                  <BookOpen className="h-4 w-4" />
                  Questions
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  className="w-full justify-start gap-2"
                  onClick={() => setActiveTab('users')}
                >
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="w-full justify-start gap-2"
                  onClick={() => setActiveTab('settings')}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </nav>
          <div className="p-6 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-6">
          <Tabs value={activeTab} className="space-y-6">
            <TabsContent value="dashboard" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Dashboard</h2>
                <Button onClick={fetchData} disabled={isLoading}>
                  Refresh
                </Button>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{questions.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{users.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Active Users (24h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{activeUsers}</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Questions</h2>
                <div className="flex gap-2">
                  <Button onClick={() => setEditingQuestion(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </div>

              <Card>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Passage</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {questions.map((question) => (
                        <TableRow key={question.id}>
                          <TableCell>{question.category}</TableCell>
                          <TableCell className="font-medium">
                            {question.passage}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingQuestion(question)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteQuestion(question.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>

              {(editingQuestion || !editingQuestion) && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingQuestion ? 'Edit Question' : 'Add New Question'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={editingQuestion ? handleUpdateQuestion : handleAddQuestion}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Passage
                        </label>
                        <Textarea
                          value={editingQuestion ? editingQuestion.passage : newQuestion.passage}
                          onChange={(e) =>
                            editingQuestion
                              ? setEditingQuestion({
                                  ...editingQuestion,
                                  passage: e.target.value,
                                })
                              : setNewQuestion({
                                  ...newQuestion,
                                  passage: e.target.value,
                                })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                        <select
                          id="category"
                          value={editingQuestion ? editingQuestion.category : newQuestion.category}
                          onChange={(e) => {
                            if (editingQuestion) {
                              setEditingQuestion({ ...editingQuestion, category: e.target.value });
                            } else {
                              setNewQuestion({ ...newQuestion, category: e.target.value });
                            }
                          }}
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          <option value="">Select a category</option>
                          <option value="Passage/Memory verses">Passage/Memory verses</option>
                          <option value="Bible Characters">Bible Characters</option>
                          <option value="Places & Location">Places & Location</option>
                          <option value="General Knowledge">General Knowledge</option>
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-sm font-medium">
                          Options
                        </label>
                        {(editingQuestion ? editingQuestion.options : newQuestion.options).map(
                          (option, index) => (
                            <div key={index} className="grid grid-cols-3 gap-4">
                              <Input
                                placeholder="Book"
                                value={option.book}
                                onChange={(e) => {
                                  const newOptions = editingQuestion
                                    ? [...editingQuestion.options]
                                    : [...newQuestion.options]
                                  newOptions[index] = {
                                    ...newOptions[index],
                                    book: e.target.value,
                                  }
                                  editingQuestion
                                    ? setEditingQuestion({
                                        ...editingQuestion,
                                        options: newOptions,
                                      })
                                    : setNewQuestion({
                                        ...newQuestion,
                                        options: newOptions,
                                      })
                                }}
                                required
                              />
                              <Input
                                type="number"
                                placeholder="Chapter"
                                value={option.chapter}
                                onChange={(e) => {
                                  const newOptions = editingQuestion
                                    ? [...editingQuestion.options]
                                    : [...newQuestion.options]
                                  newOptions[index] = {
                                    ...newOptions[index],
                                    chapter: parseInt(e.target.value),
                                  }
                                  editingQuestion
                                    ? setEditingQuestion({
                                        ...editingQuestion,
                                        options: newOptions,
                                      })
                                    : setNewQuestion({
                                        ...newQuestion,
                                        options: newOptions,
                                      })
                                }}
                                required
                              />
                              <Input
                                type="number"
                                placeholder="Verse"
                                value={option.verse}
                                onChange={(e) => {
                                  const newOptions = editingQuestion
                                    ? [...editingQuestion.options]
                                    : [...newQuestion.options]
                                  newOptions[index] = {
                                    ...newOptions[index],
                                    verse: parseInt(e.target.value),
                                  }
                                  editingQuestion
                                    ? setEditingQuestion({
                                        ...editingQuestion,
                                        options: newOptions,
                                      })
                                    : setNewQuestion({
                                        ...newQuestion,
                                        options: newOptions,
                                      })
                                }}
                                required
                              />
                            </div>
                          )
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Correct Answer
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                          <Input
                            placeholder="Book"
                            value={
                              editingQuestion
                                ? editingQuestion.correctAnswer.book
                                : newQuestion.correctAnswer.book
                            }
                            onChange={(e) =>
                              editingQuestion
                                ? setEditingQuestion({
                                    ...editingQuestion,
                                    correctAnswer: {
                                      ...editingQuestion.correctAnswer,
                                      book: e.target.value,
                                    },
                                  })
                                : setNewQuestion({
                                    ...newQuestion,
                                    correctAnswer: {
                                      ...newQuestion.correctAnswer,
                                      book: e.target.value,
                                    },
                                  })
                            }
                            required
                          />
                          <Input
                            type="number"
                            placeholder="Chapter"
                            value={
                              editingQuestion
                                ? editingQuestion.correctAnswer.chapter
                                : newQuestion.correctAnswer.chapter
                            }
                            onChange={(e) =>
                              editingQuestion
                                ? setEditingQuestion({
                                    ...editingQuestion,
                                    correctAnswer: {
                                      ...editingQuestion.correctAnswer,
                                      chapter: parseInt(e.target.value),
                                    },
                                  })
                                : setNewQuestion({
                                    ...newQuestion,
                                    correctAnswer: {
                                      ...newQuestion.correctAnswer,
                                      chapter: parseInt(e.target.value),
                                    },
                                  })
                            }
                            required
                          />
                          <Input
                            type="number"
                            placeholder="Verse"
                            value={
                              editingQuestion
                                ? editingQuestion.correctAnswer.verse
                                : newQuestion.correctAnswer.verse
                            }
                            onChange={(e) =>
                              editingQuestion
                                ? setEditingQuestion({
                                    ...editingQuestion,
                                    correctAnswer: {
                                      ...editingQuestion.correctAnswer,
                                      verse: parseInt(e.target.value),
                                    },
                                  })
                                : setNewQuestion({
                                    ...newQuestion,
                                    correctAnswer: {
                                      ...newQuestion.correctAnswer,
                                      verse: parseInt(e.target.value),
                                    },
                                  })
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Explanation
                        </label>
                        <Textarea
                          value={
                            editingQuestion
                              ? editingQuestion.explanation
                              : newQuestion.explanation
                          }
                          onChange={(e) =>
                            editingQuestion
                              ? setEditingQuestion({
                                  ...editingQuestion,
                                  explanation: e.target.value,
                                })
                              : setNewQuestion({
                                  ...newQuestion,
                                  explanation: e.target.value,
                                })
                          }
                          required
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        {editingQuestion && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditingQuestion(null)}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button type="submit" disabled={isLoading}>
                          {isLoading
                            ? editingQuestion
                              ? 'Updating...'
                              : 'Adding...'
                            : editingQuestion
                            ? 'Update Question'
                            : 'Add Question'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Bulk Import Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBulkImport} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        JSON Data
                      </label>
                      <Textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        placeholder="Paste your JSON here"
                        rows={10}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Importing...' : 'Import Questions'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Users</h2>
              </div>

              <Card>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.score}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Settings</h2>
              </div>

              <Card>
                <CardContent className="p-6">
                  <p>Settings page coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}