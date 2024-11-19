'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Home, User, BookOpen, LogOut, Settings, Edit, Trash2 } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { db, auth } from '@/lib/firebase'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, Firestore } from 'firebase/firestore'
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

interface SidebarMenuItemProps {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}

interface SidebarMenuButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}

const TypedSidebarMenuItem: React.FC<SidebarMenuItemProps> = ({ icon, onClick, children }) => (
  <SidebarMenuItem onClick={onClick}>
    {icon}
    {children}
  </SidebarMenuItem>
);

const TypedSidebarMenuButton: React.FC<SidebarMenuButtonProps> = ({ icon, onClick, children }) => (
  <SidebarMenuButton onClick={onClick}>
    {icon}
    {children}
  </SidebarMenuButton>
);

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

  const fetchQuestions = useCallback(async () => {
    if (!db) {
      console.error('Firestore is not initialized')
      return
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'))
      const fetchedQuestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizQuestion))
      setQuestions(fetchedQuestions)
    } catch (error) {
      console.error('Error fetching questions:', error)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    if (!db) {
      console.error('Firestore is not initialized')
      return
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'users'))
      const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User))
      setUsers(fetchedUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }, [])

  const fetchActiveUsers = useCallback(async () => {
    if (!db) {
      console.error('Firestore is not initialized')
      return
    }
    try {
      const activeUsersQuery = query(collection(db, 'users'), where('lastActive', '>', new Date(Date.now() - 24*60*60*1000)))
      const querySnapshot = await getDocs(activeUsersQuery)
      setActiveUsers(querySnapshot.size)
    } catch (error) {
      console.error('Error fetching active users:', error)
    }
  }, [])

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
  }, [fetchQuestions, fetchUsers, fetchActiveUsers])

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
    if (!currentUser || !db) {
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
    if (!currentUser || !editingQuestion || !db) {
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
    if (!currentUser || !db) {
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
    if (!currentUser || !db) {
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
    return null
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
      <div className="flex h-screen">
        <Sidebar>
          <SidebarHeader>
            <h2 className="text-xl font-bold">Admin Panel</h2>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <TypedSidebarMenuItem icon={<Home />} onClick={() => setActiveTab('dashboard')}>Dashboard</TypedSidebarMenuItem>
              <TypedSidebarMenuItem icon={<BookOpen />} onClick={() => setActiveTab('questions')}>Questions</TypedSidebarMenuItem>
              <TypedSidebarMenuItem icon={<User />} onClick={() => setActiveTab('users')}>Users</TypedSidebarMenuItem>
              <TypedSidebarMenuItem icon={<Settings />} onClick={() => setActiveTab('settings')}>Settings</TypedSidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <TypedSidebarMenuButton icon={<LogOut />} onClick={handleLogout}>Logout</TypedSidebarMenuButton>
        </Sidebar>
        <main className="flex-1 p-6 overflow-auto">
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>
          )}
          {activeTab === 'questions' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Questions</h2>
              <Button onClick={() => setEditingQuestion(null)} className="mb-4">Add New Question</Button>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Passage</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell>{question.passage}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setEditingQuestion(question)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteQuestion(question.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(editingQuestion !== null || editingQuestion === null) && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (editingQuestion) {
                        handleEditQuestion();
                      } else {
                        handleAddQuestion();
                      }
                    }} className="space-y-4">
                      <div>
                        <label htmlFor="passage" className="block text-sm font-medium text-gray-700">Passage</label>
                        <Textarea
                          id="passage"
                          value={editingQuestion ? editingQuestion.passage : newQuestion.passage}
                          onChange={(e) => {
                            if (editingQuestion) {
                              setEditingQuestion({ ...editingQuestion, passage: e.target.value });
                            } else {
                              setNewQuestion({ ...newQuestion, passage: e.target.value });
                            }
                          }}
                          className="mt-1 block w-full"
                          rows={3}
                        />
                      </div>
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="grid grid-cols-3 gap-4">
                          <div>
                            <label htmlFor={`option-${index}-book`} className="block text-sm font-medium text-gray-700">Option {index + 1} Book</label>
                            <Input
                              id={`option-${index}-book`}
                              value={editingQuestion ? editingQuestion.options[index].book : newQuestion.options[index].book}
                              onChange={(e) => {
                                const updatedOptions = editingQuestion ? [...editingQuestion.options] : [...newQuestion.options];
                                updatedOptions[index] = { ...updatedOptions[index], book: e.target.value };
                                if (editingQuestion) {
                                  setEditingQuestion({ ...editingQuestion, options: updatedOptions });
                                } else {
                                  setNewQuestion({ ...newQuestion, options: updatedOptions });
                                }
                              }}
                              className="mt-1 block w-full"
                            />
                          </div>
                          <div>
                            <label htmlFor={`option-${index}-chapter`} className="block text-sm font-medium text-gray-700">Chapter</label>
                            <Input
                              id={`option-${index}-chapter`}
                              type="number"
                              value={editingQuestion ? editingQuestion.options[index].chapter : newQuestion.options[index].chapter}
                              onChange={(e) => {
                                const updatedOptions = editingQuestion ? [...editingQuestion.options] : [...newQuestion.options];
                                updatedOptions[index] = { ...updatedOptions[index], chapter: parseInt(e.target.value) };
                                if (editingQuestion) {
                                  setEditingQuestion({ ...editingQuestion, options: updatedOptions });
                                } else {
                                  setNewQuestion({ ...newQuestion, options: updatedOptions });
                                }
                              }}
                              className="mt-1 block w-full"
                            />
                          </div>
                          <div>
                            <label htmlFor={`option-${index}-verse`} className="block text-sm font-medium text-gray-700">Verse</label>
                            <Input
                              id={`option-${index}-verse`}
                              type="number"
                              value={editingQuestion ? editingQuestion.options[index].verse : newQuestion.options[index].verse}
                              onChange={(e) => {
                                const updatedOptions = editingQuestion ? [...editingQuestion.options] : [...newQuestion.options];
                                updatedOptions[index] = { ...updatedOptions[index], verse: parseInt(e.target.value) };
                                if (editingQuestion) {
                                  setEditingQuestion({ ...editingQuestion, options: updatedOptions });
                                } else {
                                  setNewQuestion({ ...newQuestion, options: updatedOptions });
                                }
                              }}
                              className="mt-1 block w-full"
                            />
                          </div>
                        </div>
                      ))}
                      <div>
                        <label htmlFor="correct-answer" className="block text-sm font-medium text-gray-700">Correct Answer</label>
                        <select
                          id="correct-answer"
                          value={editingQuestion ? editingQuestion.options.findIndex(
                            (option) =>
                              option.book === editingQuestion.correctAnswer.book &&
                              option.chapter === editingQuestion.correctAnswer.chapter &&
                              option.verse === editingQuestion.correctAnswer.verse
                          ) : newQuestion.options.findIndex(
                            (option) =>
                              option.book === newQuestion.correctAnswer.book &&
                              option.chapter === newQuestion.correctAnswer.chapter &&
                              option.verse === newQuestion.correctAnswer.verse
                          )}
                          onChange={(e) => {
                            const selectedIndex = parseInt(e.target.value);
                            const selectedOption = editingQuestion ? editingQuestion.options[selectedIndex] : newQuestion.options[selectedIndex];
                            if (editingQuestion) {
                              setEditingQuestion({ ...editingQuestion, correctAnswer: selectedOption });
                            } else {
                              setNewQuestion({ ...newQuestion, correctAnswer: selectedOption });
                            }
                          }}
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          {(editingQuestion ? editingQuestion.options : newQuestion.options).map((option, index) => (
                            <option key={index} value={index}>
                              {option.book} {option.chapter}:{option.verse}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="explanation" className="block text-sm font-medium text-gray-700">Explanation</label>
                        <Textarea
                          id="explanation"
                          value={editingQuestion ? editingQuestion.explanation : newQuestion.explanation}
                          onChange={(e) => {
                            if (editingQuestion) {
                              setEditingQuestion({ ...editingQuestion, explanation: e.target.value });
                            } else {
                              setNewQuestion({ ...newQuestion, explanation: e.target.value });
                            }
                          }}
                          className="mt-1 block w-full"
                          rows={3}
                        />
                      </div>
                      <Button type="submit">{editingQuestion ? 'Update Question' : 'Add Question'}</Button>
                    </form>
                  </CardContent>
                </Card>
              )}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Add Questions from JSON</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleAddQuestionsFromJson();
                  }} className="space-y-4">
                    <Textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder="Paste your JSON here"
                      rows={10}
                    />
                    <Button type="submit">Add Questions</Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
          {activeTab === 'users' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Users</h2>
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
            </div>
          )}
          {activeTab === 'settings' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Settings</h2>
              <p>Add settings options here...</p>
            </div>
          )}
        </main>
      </div>
    </SidebarProvider>
  )
}