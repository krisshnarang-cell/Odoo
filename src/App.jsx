import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';

// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase configuration from your Firebase Console
const firebaseConfig = {
apiKey: "AIzaSyBfRn-HcEIgJH-tJKqepuKDPpkFhtcSo1I",
  authDomain: "hackathon-expensetracker.firebaseapp.com",
  projectId: "hackathon-expensetracker",
  storageBucket: "hackathon-expensetracker.firebasestorage.app",
  messagingSenderId: "1086962499029",
  appId: "1:1086962499029:web:b912992d76e47629a3915c",
  measurementId: "G-8XL9WZ2490"
};


// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Gemini API Helper ---
// This function calls the Gemini API.
// NOTE: For a production app, this should be done on a secure backend server to protect your API key.
const callGeminiAPI = async (prompt) => {
  const apiKey = ""; // Leave this empty, Canvas will handle it.
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return "Error generating response from AI.";
  }
};


// --- Helper Functions & Constants ---
const USER_ROLES = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
};

const EXPENSE_STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'];
const EXPENSE_CATEGORIES = ['Travel', 'Food', 'Office Supplies', 'Software', 'Other'];

// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) {
                const userDocRef = doc(db, 'users', authUser.uid);
                const unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        setUserData({ id: doc.id, ...doc.data() });
                    }
                    setUser(authUser);
                    setLoading(false);
                });
                return () => unsubscribeSnapshot();
            } else {
                setUser(null);
                setUserData(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleAuth = async (email, password) => {
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const newUser = userCredential.user;

                // Create a new company and admin user
                const companyDocRef = doc(collection(db, 'companies'));
                await setDoc(companyDocRef, {
                    name: `${email.split('@')[0]}'s Company`,
                    currency: 'INR', // Default currency
                    createdAt: new Date(),
                });

                await setDoc(doc(db, 'users', newUser.uid), {
                    email: newUser.email,
                    role: USER_ROLES.ADMIN,
                    companyId: companyDocRef.id,
                    createdAt: new Date(),
                    managerId: null,
                });
            }
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    if (loading) {
        return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p>Loading...</p></div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {user && userData ? (
                <Dashboard user={user} userData={userData} onLogout={handleLogout} />
            ) : (
                <AuthScreen 
                    isLogin={isLogin} 
                    setIsLogin={setIsLogin} 
                    onAuth={handleAuth} 
                    error={error} 
                />
            )}
        </div>
    );
}

// --- Authentication Screen ---
function AuthScreen({ isLogin, setIsLogin, onAuth, error }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAuth(email, password);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-800">{isLogin ? 'Login' : 'Sign Up'}</h2>
                <p className="text-center text-gray-600">
                    {isLogin ? "Welcome back!" : "Create your account and company"}
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        required
                        className="w-full px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        className="w-full px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        {isLogin ? 'Login' : 'Sign Up'}
                    </button>
                </form>
                <p className="text-sm text-center text-gray-600">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-blue-600 hover:underline">
                        {isLogin ? 'Sign up' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
}

// --- Main Dashboard ---
function Dashboard({ user, userData, onLogout }) {
    return (
        <div className="flex h-screen">
            <Sidebar onLogout={onLogout} userEmail={user.email} userRole={userData.role} />
            <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-gray-100">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Expense Management Dashboard</h1>
                    {userData.role === USER_ROLES.ADMIN && <AdminView userData={userData} />}
                    {userData.role === USER_ROLES.MANAGER && <ManagerView userData={userData} />}
                    {userData.role === USER_ROLES.EMPLOYEE && <EmployeeView userData={userData} />}
                </div>
            </main>
        </div>
    );
}

// --- Sidebar ---
function Sidebar({ onLogout, userEmail, userRole }) {
    return (
        <div className="w-64 bg-white shadow-md flex flex-col p-4">
            <div className="flex items-center mb-8">
                   <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                    {userEmail.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{userEmail}</p>
                    <p className="text-xs text-gray-500">{userRole}</p>
                </div>
            </div>
            <nav className="flex-1">
                {/* Navigation items can be added here based on role */}
            </nav>
            <button onClick={onLogout} className="w-full mt-auto px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-md hover:bg-red-600">
                Logout
            </button>
        </div>
    );
}

// --- Admin View ---
function AdminView({ userData }) {
    const [activeTab, setActiveTab] = useState('users');
    return (
        <div>
            <div className="mb-6 border-b border-gray-200">
                <nav className="flex space-x-4">
                    <button onClick={() => setActiveTab('users')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>User Management</button>
                    <button onClick={() => setActiveTab('workflows')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'workflows' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Approval Workflows</button>
                    <button onClick={() => setActiveTab('expenses')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'expenses' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>All Expenses</button>
                </nav>
            </div>
            {activeTab === 'users' && <UserManagement companyId={userData.companyId} />}
            {activeTab === 'workflows' && <ApprovalWorkflow companyId={userData.companyId} />}
            {activeTab === 'expenses' && <AllExpensesView companyId={userData.companyId} />}
        </div>
    );
}

// --- Manager View ---
function ManagerView({ userData }) {
    const [expenses, setExpenses] = useState([]);
    const [teamExpenses, setTeamExpenses] = useState([]);
    const [aiSummary, setAiSummary] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    
    useEffect(() => {
        const q = query(collection(db, 'expenses'), where('currentApproverId', '==', userData.id), where('status', '==', EXPENSE_STATUS.PENDING));
        const unsubscribe = onSnapshot(q, snapshot => {
            setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribe;
    }, [userData.id]);

    useEffect(() => {
        const qTeam = query(collection(db, 'expenses'), where('managerId', '==', userData.id));
        const unsubscribeTeam = onSnapshot(qTeam, snapshot => {
            setTeamExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribeTeam;
    }, [userData.id]);
    
    const handleGetSummary = async () => {
        setIsSummaryLoading(true);
        setAiSummary('');
        const expenseDetails = expenses.map(e => `- ${e.amount} ${e.currency} for "${e.description}" by ${e.employeeEmail}`).join('\n');
        const prompt = `Please provide a brief summary and analysis of the following pending expenses for a manager. Highlight the total amount, the largest expense, and any potential patterns or items that might need closer review. Keep it concise and professional.\n\nExpenses:\n${expenseDetails}`;
        
        const summary = await callGeminiAPI(prompt);
        setAiSummary(summary);
        setIsSummaryLoading(false);
    };

    return (
        <div className="space-y-8">
            <ApprovalQueue 
                expenses={expenses} 
                userData={userData} 
                title="Pending My Approval" 
                onGetSummary={handleGetSummary}
                isSummaryLoading={isSummaryLoading}
                aiSummary={aiSummary}
            />
            <ExpenseHistory expenses={teamExpenses} title="My Team's Expenses" />
        </div>
    );
}


// --- Employee View ---
function EmployeeView({ userData }) {
    const [myExpenses, setMyExpenses] = useState([]);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        if (!userData || !userData.id) return;
        const q = query(collection(db, 'expenses'), where('employeeId', '==', userData.id));
        const unsubscribe = onSnapshot(q, snapshot => {
            const sortedExpenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => b.date.toDate() - a.date.toDate());
            setMyExpenses(sortedExpenses);
        });
        return unsubscribe;
    }, [userData.id]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-gray-700">My Expenses</h2>
                <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    {showForm ? 'Cancel' : '+ New Expense'}
                </button>
            </div>
            {showForm && <ExpenseForm userData={userData} onSubmitted={() => setShowForm(false)} />}
            <ExpenseHistory expenses={myExpenses} title="Submission History" />
        </div>
    );
}


// --- Components for Admin ---

function UserManagement({ companyId }) {
    const [users, setUsers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState(USER_ROLES.EMPLOYEE);
    const [managerId, setManagerId] = useState('');
    
    useEffect(() => {
        const q = query(collection(db, 'users'), where('companyId', '==', companyId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(userList);
            setManagers(userList.filter(u => u.role === USER_ROLES.MANAGER || u.role === USER_ROLES.ADMIN));
        });
        return unsubscribe;
    }, [companyId]);

    const handleAddUser = async (e) => {
        e.preventDefault();
        // This won't create an auth user, just a record in Firestore. 
        // A real app would use a more complex invite system.
        await addDoc(collection(db, 'users'), {
            email,
            role,
            managerId: role === USER_ROLES.EMPLOYEE ? managerId : null,
            companyId,
            createdAt: new Date(),
        });
        setEmail('');
        setRole(USER_ROLES.EMPLOYEE);
        setManagerId('');
    };
    
    const handleRoleChange = async (userId, newRole) => {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { role: newRole });
    };
    
    const handleManagerChange = async (userId, newManagerId) => {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { managerId: newManagerId });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Manage Users</h3>
            <form onSubmit={handleAddUser} className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="New User Email" className="w-full form-input" required />
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full form-select">
                    <option value={USER_ROLES.EMPLOYEE}>Employee</option>
                    <option value={USER_ROLES.MANAGER}>Manager</option>
                </select>
                {role === USER_ROLES.EMPLOYEE && (
                    <select value={managerId} onChange={e => setManagerId(e.target.value)} className="w-full form-select" required>
                        <option value="">Select Manager</option>
                        {managers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                    </select>
                )}
                <button type="submit" className="px-4 py-2 font-semibold text-white bg-green-500 rounded-md hover:bg-green-600">Add User</button>
            </form>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="th">Email</th>
                            <th className="th">Role</th>
                            <th className="th">Manager</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="td">{user.email}</td>
                                <td className="td">
                                    <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value)} className="form-select text-sm py-1">
                                        <option value={USER_ROLES.ADMIN}>Admin</option>
                                        <option value={USER_ROLES.MANAGER}>Manager</option>
                                        <option value={USER_ROLES.EMPLOYEE}>Employee</option>
                                    </select>
                                </td>
                                <td className="td">
                                   {user.role === USER_ROLES.EMPLOYEE && (
                                        <select value={user.managerId || ''} onChange={(e) => handleManagerChange(user.id, e.target.value)} className="form-select text-sm py-1">
                                            <option value="">None</option>
                                            {managers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                                        </select>
                                   )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ApprovalWorkflow({ companyId }) {
    return <div className="bg-white p-6 rounded-lg shadow"><p className="text-gray-600">Approval workflow configuration UI would be here. This feature requires a complex setup involving defining sequences and conditional rules, which is extensive for a single file implementation.</p></div>;
}

function AllExpensesView({ companyId }) {
    const [allExpenses, setAllExpenses] = useState([]);

    useEffect(() => {
        const q = query(collection(db, 'expenses'), where('companyId', '==', companyId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const expensesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => b.date.toDate() - a.date.toDate());
            setAllExpenses(expensesList);
        });
        return unsubscribe;
    }, [companyId]);

    const handleOverride = async (expenseId, newStatus) => {
        // In a real app, use a modal instead of window.confirm
        if (window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this expense?`)) {
            const expenseDocRef = doc(db, 'expenses', expenseId);
            await updateDoc(expenseDocRef, { 
                status: newStatus,
                currentApproverId: null 
            });
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">All Company Expenses</h3>
            <ExpenseTable 
                expenses={allExpenses} 
                isAdminOverride={true} 
                onOverride={handleOverride}
            />
        </div>
    );
}

// --- Common Components ---

function ExpenseForm({ userData, onSubmitted }) {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState(CURRENCIES[0]);
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [description, setDescription] = useState('');
    const [descriptionKeywords, setDescriptionKeywords] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleGenerateDescription = async () => {
        if (!descriptionKeywords) return;
        setIsGenerating(true);
        const prompt = `Based on these keywords for an expense report, generate a concise, professional, one-sentence description: "${descriptionKeywords}"`;
        const generatedDesc = await callGeminiAPI(prompt);
        setDescription(generatedDesc.replace(/"/g, '')); // Remove quotes from AI response
        setIsGenerating(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!userData.managerId) {
            // Use a better notification system in a real app
            alert("Error: You do not have a manager assigned. Please contact your administrator.");
            return;
        }

        await addDoc(collection(db, 'expenses'), {
            employeeId: userData.id,
            employeeEmail: userData.email,
            companyId: userData.companyId,
            managerId: userData.managerId,
            amount: parseFloat(amount),
            currency,
            category,
            description,
            date: new Date(date),
            status: EXPENSE_STATUS.PENDING,
            currentApproverId: userData.managerId,
            approvalHistory: [],
            createdAt: new Date(),
        });

        onSubmitted();
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Submit New Expense</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" className="form-input" required />
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="form-select">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={category} onChange={e => setCategory(e.target.value)} className="form-select">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" required />
                
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Description Keywords (for AI)</label>
                    <div className="flex">
                        <input
                            type="text"
                            value={descriptionKeywords}
                            onChange={e => setDescriptionKeywords(e.target.value)}
                            placeholder="e.g., lunch client project X"
                            className="form-input rounded-r-none"
                        />
                        <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="px-4 py-2 font-semibold text-white bg-purple-600 rounded-r-md hover:bg-purple-700 disabled:bg-purple-300">
                           {isGenerating ? '...' : '✨ Generate'}
                        </button>
                    </div>
                </div>

                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Full Description" className="form-input md:col-span-2" required />
                <div className="md:col-span-2 text-right">
                    <button type="submit" className="px-6 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Submit</button>
                </div>
            </form>
        </div>
    );
}

function ExpenseHistory({ expenses, title }) {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">{title}</h3>
            {expenses.length > 0 ? (
                <ExpenseTable expenses={expenses} />
            ) : (
                <p className="text-gray-500">No expenses found.</p>
            )}
        </div>
    );
}

function ApprovalQueue({ expenses, userData, title, onGetSummary, isSummaryLoading, aiSummary }) {
    const handleApproval = async (expense, newStatus) => {
        const expenseDocRef = doc(db, 'expenses', expense.id);
        
        await updateDoc(expenseDocRef, {
            status: newStatus,
            currentApproverId: null, // Simplified: no next approver
            approvalHistory: [
                ...(expense.approvalHistory || []),
                {
                    approverId: userData.id,
                    approverEmail: userData.email,
                    status: newStatus,
                    timestamp: new Date(),
                }
            ]
        });
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-700">{title}</h3>
                <button onClick={onGetSummary} disabled={isSummaryLoading || expenses.length === 0} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-300">
                    {isSummaryLoading ? "Analyzing..." : "✨ Get AI Summary"}
                </button>
            </div>
            
            {aiSummary && (
                <div className="bg-purple-50 border-l-4 border-purple-500 text-purple-800 p-4 mb-4 rounded-r-lg">
                    <h4 className="font-bold">AI Analysis</h4>
                    <p className="text-sm whitespace-pre-wrap">{aiSummary}</p>
                </div>
            )}

            {expenses.length > 0 ? (
                <ExpenseTable expenses={expenses} isApproval={true} onApprove={(expense) => handleApproval(expense, EXPENSE_STATUS.APPROVED)} onReject={(expense) => handleApproval(expense, EXPENSE_STATUS.REJECTED)} />
            ) : (
                <p className="text-gray-500">No expenses awaiting your approval.</p>
            )}
        </div>
    );
}

function ExpenseTable({ expenses, isApproval = false, onApprove, onReject, isAdminOverride = false, onOverride }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        { isAdminOverride && <th className="th">Employee</th> }
                        <th className="th">Date</th>
                        <th className="th">Amount</th>
                        <th className="th">Category</th>
                        <th className="th">Status</th>
                        <th className="th">Description</th>
                        { (isApproval || isAdminOverride) && <th className="th">Actions</th> }
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.map(expense => (
                        <tr key={expense.id}>
                            { isAdminOverride && <td className="td">{expense.employeeEmail}</td> }
                            <td className="td">{expense.date?.toDate().toLocaleDateString() || 'N/A'}</td>
                            <td className="td">{new Intl.NumberFormat('en-US', { style: 'currency', currency: expense.currency }).format(expense.amount)}</td>
                            <td className="td">{expense.category}</td>
                            <td className="td">
                                <StatusBadge status={expense.status} />
                            </td>
                            <td className="td truncate max-w-xs">{expense.description}</td>
                            { isApproval && (
                                <td className="td space-x-2">
                                    <button onClick={() => onApprove(expense)} className="px-2 py-1 text-xs font-semibold text-white bg-green-500 rounded hover:bg-green-600">Approve</button>
                                    <button onClick={() => onReject(expense)} className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded hover:bg-red-600">Reject</button>
                                </td>
                            )}
                            { isAdminOverride && (
                                <td className="td space-x-2">
                                    <button onClick={() => onOverride(expense.id, EXPENSE_STATUS.APPROVED)} className="px-2 py-1 text-xs font-semibold text-white bg-green-500 rounded hover:bg-green-600" disabled={expense.status === EXPENSE_STATUS.APPROVED}>Approve</button>
                                    <button onClick={() => onOverride(expense.id, EXPENSE_STATUS.REJECTED)} className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded hover:bg-red-600" disabled={expense.status === EXPENSE_STATUS.REJECTED}>Reject</button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function StatusBadge({ status }) {
    const baseClasses = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full";
    const statusClasses = {
        [EXPENSE_STATUS.PENDING]: "bg-yellow-100 text-yellow-800",
        [EXPENSE_STATUS.APPROVED]: "bg-green-100 text-green-800",
        [EXPENSE_STATUS.REJECTED]: "bg-red-100 text-red-800",
    };
    return <span className={`${baseClasses} ${statusClasses[status] || ''}`}>{status}</span>;
}

// Simple CSS-in-JS for Tailwind form styles
const formStyles = `
.form-input, .form-select {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: #374151;
    background-color: #F9FAFB;
    border: 1px solid #D1D5DB;
    border-radius: 0.375rem;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}
.form-input:focus, .form-select:focus {
    outline: none;
    border-color: #3B82F6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}
.th {
    padding: 0.75rem 1.5rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: #4B5563;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.td {
    padding: 1rem 1.5rem;
    font-size: 0.875rem;
    color: #374151;
    white-space: nowrap;
}
`;
const styleSheet = document.createElement("style");
styleSheet.innerText = formStyles;
document.head.appendChild(styleSheet);

