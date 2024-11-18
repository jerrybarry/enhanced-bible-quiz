'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Home, User, BookOpen, LogOut, Settings, Plus, Trash2, Edit, Users, BookOpenCheck, UsersIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { db, auth } from '@/lib/firebase'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore'
import { signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth'

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

export default function AdminPanel() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [activeUsers, setActiveUsers] = useState<number>(0)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null)
  const [newQuestion, setNewQuestion] = useState<Omit<QuizQuestion, 'id'>>({
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isClient, setIsClient] = useState(false)
  const [jsonInput, setJsonInput] = useState('')

  useEffect(() => {
    setIsClient(true)
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user)
      if (user) {
        fetchQuestions()
        fetchUsers()
        fetchActiveUsers()
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchQuestions = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'))
      const fetchedQuestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizQuestion))
      setQuestions(fetchedQuestions)
    } catch (error) {
      console.error('Error fetching questions:', error)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'))
      const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User))
      setUsers(fetchedUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }, [])

  const fetchActiveUsers = useCallback(async () => {
    try {
      const activeUsersQuery = query(collection(db, 'users'), where('lastActive', '>', new Date(Date.now() - 24*60*60*1000)))
      const querySnapshot = await getDocs(activeUsersQuery)
      setActiveUsers(querySnapshot.size)
    } catch (error) {
      console.error('Error fetching active users:', error)
    }
  }, [])

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error('Error signing in:', error)
      alert('Invalid email or password')
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setActiveTab('dashboard')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleAddQuestion = async () => {
    if (!currentUser) {
      alert('You must be logged in to add questions')
      return
    }
    try {
      const docRef = await addDoc(collection(db, 'questions'), newQuestion)
      setQuestions([...questions, { ...newQuestion, id: docRef.id }])
      setNewQuestion({
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
      alert('Question added successfully!')
    } catch (error) {
      console.error('Error adding question:', error)
      alert('Failed to add question')
    }
  }

  const handleEditQuestion = async () => {
    if (!currentUser || !editingQuestion) {
      alert('You must be logged in to edit questions')
      return
    }
    try {
      await updateDoc(doc(db, 'questions', editingQuestion.id), Object.fromEntries(Object.entries(editingQuestion).filter(([key]) => key !== 'id')))
      setQuestions(questions.map(q => q.id === editingQuestion.id ? editingQuestion : q))
      setEditingQuestion(null)
      alert('Question updated successfully!')
    } catch (error) {
      console.error('Error updating question:', error)
      alert('Failed to update question')
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!currentUser) {
      alert('You must be logged in to delete questions')
      return
    }
    try {
      await deleteDoc(doc(db, 'questions', id))
      setQuestions(questions.filter(q => q.id !== id))
      alert('Question deleted successfully!')
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('Failed to delete question')
    }
  }

  const handleAddQuestionsFromJson = async () => {
    if (!currentUser) {
      alert('You must be logged in to add questions')
      return
    }
    try {
      const parsedQuestions = JSON.parse(jsonInput)
      if (!Array.isArray(parsedQuestions)) {
        throw new Error('Input must be an array of questions')
      }

      const addedQuestions = await Promise.all(parsedQuestions.map(async (question) => {
        const docRef = await addDoc(collection(db, 'questions'), question)
        return { ...question, id: docRef.id }
      }))

      setQuestions([...questions, ...addedQuestions])
      setJsonInput('')
      alert('Questions added successfully!')
    } catch (error) {
      console.error('Error adding questions from JSON:', error)
      alert('Failed to add questions. Please check your JSON format.')
    }
  }

  if (!isClient) {
    return null // or a loading spinner
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-purple-800 dark:text-purple-200">Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button onClick={handleLogin} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
        <Sidebar className="hidden md:block">
          <SidebarHeader>
            <h2 className="text-xl font-bold text-purple-800 dark:text-purple-200 p-4">Admin Panel</h2>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('dashboard')} isActive={activeTab === 'dashboard'}>
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('questions')} isActive={activeTab === 'questions'}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Questions
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('users')} isActive={activeTab === 'users'}>
                  <User className="w-4 h-4 mr-2" />
                  Users
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-1 flex-col w-full">
          <header className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 shadow w-full">
            <div>
              <SidebarTrigger className="md:hidden" />
            </div>
            <div className="flex items-center">
              <span className="mr-2">{currentUser?.email}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 rounded-full">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setActiveTab('profile')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 w-full">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Welcome, {currentUser?.email} 👋</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
                          <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{questions.length}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                          <UsersIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{users.length}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Active Players</CardTitle>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{activeUsers}</div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'questions' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => { e.preventDefault(); editingQuestion ? handleEditQuestion() : handleAddQuestion(); }} className="space-y-4">
                      <div>
                        <label htmlFor="passage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Passage</label>
                        <Textarea
                          id="passage"
                          value={editingQuestion ? editingQuestion.passage : newQuestion.passage}
                          onChange={(e) => editingQuestion ? setEditingQuestion({...editingQuestion, passage: e.target.value}) : setNewQuestion({ ...newQuestion, passage: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      {(editingQuestion ? editingQuestion.options : newQuestion.options).map((option, index) => (
                        <div key={index} className="flex space-x-2">
                          <Input
                            placeholder="Book"
                            value={option.book}
                            onChange={(e) => {
                              const newOptions = editingQuestion ? [...editingQuestion.options] : [...newQuestion.options];
                              newOptions[index].book = e.target.value;
                              editingQuestion ? setEditingQuestion({...editingQuestion, options: newOptions}) : setNewQuestion({ ...newQuestion, options: newOptions });
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Chapter"
                            value={option.chapter || ''}
                            onChange={(e) => {
                              const newOptions = editingQuestion ? [...editingQuestion.options] : [...newQuestion.options];
                              newOptions[index].chapter = parseInt(e.target.value, 10);
                              editingQuestion ? setEditingQuestion({...editingQuestion, options: newOptions}) :
                                setNewQuestion({ ...newQuestion, options: newOptions });
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Verse"
                            value={option.verse || ''}
                            onChange={(e) => {
                              const newOptions = editingQuestion ? [...editingQuestion.options] : [...newQuestion.options];
                              newOptions[index].verse = parseInt(e.target.value, 10);
                              editingQuestion ?
                                setEditingQuestion({...editingQuestion, options: newOptions}) :
                                setNewQuestion({ ...newQuestion, options: newOptions});
                            }}
                          />
                        </div>
                      ))}
                      <div>
                        <label htmlFor="correctAnswer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Correct Answer</label>
                        <div className="flex space-x-2 mt-1">
                          <Input
                            id="correctAnswer"
                            placeholder="Book"
                            value={editingQuestion ? editingQuestion.correctAnswer.book : newQuestion.correctAnswer.book}
                            onChange={(e) => editingQuestion ?
                              setEditingQuestion({...editingQuestion, correctAnswer: {...editingQuestion.correctAnswer, book: e.target.value}}) :
                              setNewQuestion({ ...newQuestion, correctAnswer: { ...newQuestion.correctAnswer, book: e.target.value } })
                            }
                          />
                          <Input
                            type="number"
                            placeholder="Chapter"
                            value={editingQuestion ? editingQuestion.correctAnswer.chapter || '' : newQuestion.correctAnswer.chapter || ''}
                            onChange={(e) => editingQuestion ?
                              setEditingQuestion({...editingQuestion, correctAnswer: {...editingQuestion.correctAnswer, chapter: parseInt(e.target.value, 10)}}) :
                              setNewQuestion({ ...newQuestion, correctAnswer: { ...newQuestion.correctAnswer, chapter: parseInt(e.target.value, 10) } })
                            }
                          />
                          <Input
                            type="number"
                            placeholder="Verse"
                            value={editingQuestion ? editingQuestion.correctAnswer.verse || '' : newQuestion.correctAnswer.verse || ''}
                            onChange={(e) => editingQuestion ?
                              setEditingQuestion({...editingQuestion, correctAnswer: {...editingQuestion.correctAnswer, verse: parseInt(e.target.value, 10)}}) :
                              setNewQuestion({ ...newQuestion, correctAnswer: { ...newQuestion.correctAnswer, verse: parseInt(e.target.value, 10) } })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="explanation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Explanation</label>
                        <Textarea
                          id="explanation"
                          value={editingQuestion ? editingQuestion.explanation : newQuestion.explanation}
                          onChange={(e) => editingQuestion ?
                            setEditingQuestion({...editingQuestion, explanation: e.target.value}) :
                            setNewQuestion({ ...newQuestion, explanation: e.target.value })
                          }
                          className="mt-1"
                        />
                      </div>
                      <Button type="submit">
                        {editingQuestion ? (
                          <>
                            <Edit className="w-4 h-4 mr-2" />
                            Update Question
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Question
                          </>
                        )}
                      </Button>
                      {editingQuestion && (
                        <Button type="button" variant="outline" onClick={() => setEditingQuestion(null)}>
                          Cancel Edit
                        </Button>
                      )}
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Add Questions from JSON</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => { e.preventDefault(); handleAddQuestionsFromJson(); }} className="space-y-4">
                      <div>
                        <label htmlFor="jsonInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300">JSON Input</label>
                        <Textarea
                          id="jsonInput"
                          value={jsonInput}
                          onChange={(e) => setJsonInput(e.target.value)}
                          className="mt-1"
                          placeholder='[{"passage": "...", "options": [...], "correctAnswer": {...}, "explanation": "..."}]'
                          rows={10}
                        />
                      </div>
                      <Button type="submit">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Questions from JSON
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Manage Questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Passage</TableHead>
                          <TableHead>Correct Answer</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {questions.map((question) => (
                          <TableRow key={question.id}>
                            <TableCell>{question.passage.substring(0, 50)}...</TableCell>
                            <TableCell>{`${question.correctAnswer.book} ${question.correctAnswer.chapter}:${question.correctAnswer.verse}`}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => setEditingQuestion(question)} className="mr-2">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteQuestion(question.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'users' && (
              <Card>
                <CardHeader>
                  <CardTitle>User List</CardTitle>
                </CardHeader>
                <CardContent>
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
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.score}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {activeTab === 'profile' && (
              <Card>
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Add form fields here to update user profile information. (To be implemented)</p>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}