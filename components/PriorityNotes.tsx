
import React, { useState, useEffect } from 'react';
import { Circle, CheckCircle2, Calendar, Clock, Plus, Trash2, Edit2, X, Sun, Repeat, Settings2, Briefcase, ChevronRight, GripVertical } from 'lucide-react';
import { doc, updateDoc, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase.ts';
import { Task, Project } from '../types.ts';
import { getThailandTodayStr } from '../utils/dateUtils.ts';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PriorityNotesProps {
  userId: string;
}

const DEFAULT_RECURRING = ["Preply", "Whatsapp", "IG", "Line", "Mails"];

interface SortableProjectProps {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (desc: string) => void;
}

const SortableProject: React.FC<SortableProjectProps> = ({ 
  project, 
  isExpanded, 
  onToggle, 
  onDelete, 
  onUpdateTitle,
  onUpdateDescription 
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 0,
    position: 'relative' as const,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden transition-all hover:border-slate-200 ${isDragging ? 'shadow-xl border-brand-200 opacity-50' : 'opacity-100'}`}
    >
      <div 
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 transition-colors shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={16} />
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors shrink-0 ${
            project.urgency === 1 ? 'bg-red-500 text-white shadow-sm shadow-red-100' :
            project.urgency === 2 ? 'bg-orange-500 text-white shadow-sm shadow-orange-100' :
            project.urgency === 3 ? 'bg-amber-500 text-white shadow-sm shadow-amber-100' :
            'bg-slate-100 text-slate-500'
          }`}>
            {project.urgency || '?'}
          </div>
          
          <div className="flex-1 min-w-0 flex items-center gap-2 group/title">
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={project.title}
                onChange={(e) => onUpdateTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-slate-50 border border-brand-200 rounded px-2 py-0.5 text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-brand-500"
              />
            ) : (
              <>
                <h4 className="text-sm font-bold text-slate-800 truncate">{project.title}</h4>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
                  className="p-1 text-slate-100 hover:text-slate-400 opacity-0 group-hover/title:opacity-100 transition-all rounded"
                >
                  <Edit2 size={12} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-200 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
          <ChevronRight size={18} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-50 pt-3 animate-in fade-in duration-200 space-y-3">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Project Notes</label>
            <textarea 
              value={project.description}
              onChange={(e) => onUpdateDescription(e.target.value)}
              placeholder="Add project details, steps, or notes here..."
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-medium text-slate-700 min-h-[120px] outline-none focus:bg-white focus:ring-1 focus:ring-brand-200 transition-all custom-scrollbar"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const PriorityNotes: React.FC<PriorityNotesProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<Task[]>([]);
  const [laterTasks, setLaterTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<string[]>([]);
  
  const [newTaskText, setNewTaskText] = useState('');
  const [addingTo, setAddingTo] = useState<'today' | 'tomorrow' | 'later' | 'project' | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  const [showRecurringManager, setShowRecurringManager] = useState(false);
  const [newRecurringText, setNewRecurringText] = useState('');

  // Project focused states
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!userId) return;
    const docRef = doc(db, 'users', userId, 'settings', 'main');
    
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const todayStr = getThailandTodayStr();
        const lastReset = data.lastChecklistReset || '';
        const templates = data.recurringTaskTemplates || DEFAULT_RECURRING;
        
        setRecurringTemplates(templates);
        setTomorrowTasks(data.tasksTomorrow || []);
        setLaterTasks(data.tasksLater || []);
        
        // Sort projects by urgency here to maintain visual integrity
        const sortedProjects = (data.ongoingProjects || []).sort((a: Project, b: Project) => {
          const urgencyA = a.urgency ?? 999;
          const urgencyB = b.urgency ?? 999;
          if (urgencyA !== urgencyB) return urgencyA - urgencyB;
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        setProjects(sortedProjects);

        if (lastReset !== todayStr) {
          const freshToday: Task[] = templates.map((text: string) => ({
            id: `rec_${Math.random().toString(36).substr(2, 9)}`,
            text,
            isDone: false,
            createdAt: Date.now()
          }));
          
          await updateDoc(docRef, {
            tasksToday: freshToday,
            lastChecklistReset: todayStr,
            recurringTaskTemplates: templates
          });
          setTodayTasks(freshToday);
        } else {
          setTodayTasks(data.tasksToday || []);
        }
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const addTask = async (field: 'today' | 'tomorrow' | 'later') => {
    if (!newTaskText.trim()) return;
    const task: Task = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTaskText.trim(),
      isDone: false,
      createdAt: Date.now()
    };
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    const fieldName = field === 'today' ? 'tasksToday' : field === 'tomorrow' ? 'tasksTomorrow' : 'tasksLater';
    await updateDoc(userRef, { [fieldName]: arrayUnion(task) });
    setNewTaskText('');
    setAddingTo(null);
  };

  const addProject = async () => {
    if (!newProjectTitle.trim()) return;
    const project: Project = {
      id: Math.random().toString(36).substr(2, 9),
      title: newProjectTitle.trim(),
      description: '',
      status: 'active',
      urgency: projects.length + 1,
      createdAt: Date.now()
    };
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    await updateDoc(userRef, { ongoingProjects: arrayUnion(project) });
    setNewProjectTitle('');
    setAddingTo(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);

    const newOrder = arrayMove(projects, oldIndex, newIndex);
    
    // Update all projects with their new urgency based on index
    const rankedProjects = newOrder.map((p, idx) => ({
      ...p,
      urgency: idx + 1
    }));

    setProjects(rankedProjects);

    // Save full list to Firestore
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    await updateDoc(userRef, { ongoingProjects: rankedProjects });
  };

  const addRecurringTemplate = async () => {
    if (!newRecurringText.trim()) return;
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    await updateDoc(userRef, { recurringTaskTemplates: arrayUnion(newRecurringText.trim()) });
    const newTask: Task = {
        id: `rec_${Math.random().toString(36).substr(2, 9)}`,
        text: newRecurringText.trim(),
        isDone: false,
        createdAt: Date.now()
    };
    await updateDoc(userRef, { tasksToday: arrayUnion(newTask) });
    setNewRecurringText('');
  };

  const removeRecurringTemplate = async (template: string) => {
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    await updateDoc(userRef, { recurringTaskTemplates: arrayRemove(template) });
  };

  const toggleTask = async (task: Task, field: 'today' | 'tomorrow' | 'later') => {
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    const fieldName = field === 'today' ? 'tasksToday' : field === 'tomorrow' ? 'tasksTomorrow' : 'tasksLater';
    await updateDoc(userRef, { [fieldName]: arrayRemove(task) });
    await updateDoc(userRef, { [fieldName]: arrayUnion({ ...task, isDone: !task.isDone }) });
  };

  const saveEdit = async (task: Task, field: 'today' | 'tomorrow' | 'later') => {
    if (!editingText.trim()) return;
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    const fieldName = field === 'today' ? 'tasksToday' : field === 'tomorrow' ? 'tasksTomorrow' : 'tasksLater';
    await updateDoc(userRef, { [fieldName]: arrayRemove(task) });
    await updateDoc(userRef, { [fieldName]: arrayUnion({ ...task, text: editingText.trim() }) });
    setEditingTaskId(null);
  };

  const deleteTask = async (task: Task, field: 'today' | 'tomorrow' | 'later') => {
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    const fieldName = field === 'today' ? 'tasksToday' : field === 'tomorrow' ? 'tasksTomorrow' : 'tasksLater';
    await updateDoc(userRef, { [fieldName]: arrayRemove(task) });
  };

  const updateProjectDescription = async (project: Project, description: string) => {
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    const updatedProjects = projects.map(p => p.id === project.id ? { ...p, description } : p);
    setProjects(updatedProjects);
    await updateDoc(userRef, { ongoingProjects: updatedProjects });
  };

  const updateProjectTitle = async (project: Project, title: string) => {
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    const updatedProjects = projects.map(p => p.id === project.id ? { ...p, title } : p);
    setProjects(updatedProjects);
    await updateDoc(userRef, { ongoingProjects: updatedProjects });
  };

  const deleteProject = async (project: Project) => {
    const userRef = doc(db, 'users', userId, 'settings', 'main');
    const remaining = projects.filter(p => p.id !== project.id)
      .map((p, idx) => ({ ...p, urgency: idx + 1 }));
    setProjects(remaining);
    await updateDoc(userRef, { ongoingProjects: remaining });
  };

  const TaskItem = ({ task, field }: { task: Task, field: 'today' | 'tomorrow' | 'later' }) => (
    <div className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-2xl group transition-all hover:shadow-sm">
      <button 
        onClick={() => toggleTask(task, field)}
        className={`mt-0.5 transition-colors ${task.isDone ? 'text-emerald-500' : 'text-slate-200 hover:text-slate-400'}`}
      >
        {task.isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
      {editingTaskId === task.id ? (
        <div className="flex-1 space-y-2">
          <textarea
            autoFocus
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 min-h-[60px] resize-none"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && saveEdit(task, field)}
          />
          <div className="flex justify-end gap-2 text-[10px] font-black uppercase">
            <button onClick={() => setEditingTaskId(null)} className="text-slate-400 hover:text-slate-600">Cancel</button>
            <button onClick={() => saveEdit(task, field)} className="text-brand-600">Save</button>
          </div>
        </div>
      ) : (
        <div className="flex-1" onClick={() => { setEditingTaskId(task.id); setEditingText(task.text); }}>
          <p className="text-xs font-bold leading-normal pr-6 relative cursor-text text-slate-800">
            {task.text}
            <Edit2 size={12} className="absolute right-0 top-0 text-slate-100 group-hover:text-slate-300 transition-colors" />
          </p>
        </div>
      )}
      <button onClick={() => deleteTask(task, field)} className="text-slate-100 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="bg-slate-50 rounded-3xl p-6 space-y-6 flex flex-col h-full max-h-[90vh]">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Strategy Center</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Organize daily actions & big projects</p>
            </div>
            <button 
              onClick={() => setShowRecurringManager(!showRecurringManager)}
              className={`p-2 rounded-xl transition-all ${showRecurringManager ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 hover:text-brand-600 shadow-sm border border-slate-100'}`}
              title="Daily Recurring Config"
            >
              <Settings2 size={18} />
            </button>
        </div>

        <div className="flex bg-slate-200/50 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'tasks' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Calendar size={14} /> Action List
          </button>
          <button 
            onClick={() => setActiveTab('projects')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'projects' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Briefcase size={14} /> Ongoing Projects
          </button>
        </div>
      </div>

      {showRecurringManager && (
        <div className="shrink-0 p-4 bg-white border border-slate-200 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-300">
           <div className="flex items-center gap-2 mb-2">
             <Repeat size={14} className="text-brand-500" />
             <span className="text-[10px] font-black uppercase text-slate-700">Daily Routine Template</span>
           </div>
           <div className="flex flex-wrap gap-2">
             {recurringTemplates.map(t => (
               <div key={t} className="flex items-center gap-2 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600">
                 {t}
                 <button onClick={() => removeRecurringTemplate(t)} className="text-slate-300 hover:text-red-500"><X size={12} /></button>
               </div>
             ))}
           </div>
           <div className="flex gap-2">
             <input 
               type="text" 
               value={newRecurringText} 
               onChange={e => setNewRecurringText(e.target.value)}
               placeholder="Add daily recurring..."
               className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500"
               onKeyDown={e => e.key === 'Enter' && addRecurringTemplate()}
             />
             <button onClick={addRecurringTemplate} className="p-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-all"><Plus size={16} /></button>
           </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {activeTab === 'tasks' ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between sticky top-0 bg-slate-50 py-1 z-10">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-orange-50 text-orange-600 rounded-md"><Sun size={14} /></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">To Do Today</span>
                </div>
                <button 
                  onClick={() => setAddingTo(addingTo === 'today' ? null : 'today')}
                  className={`p-1 rounded-md transition-colors ${addingTo === 'today' ? 'bg-slate-200 text-slate-600' : 'text-orange-500 hover:bg-orange-50'}`}
                >
                  {addingTo === 'today' ? <X size={16} /> : <Plus size={16} />}
                </button>
              </div>
              {addingTo === 'today' && (
                <input 
                  autoFocus
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask('today')}
                  placeholder="Add task for today..."
                  className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              )}
              <div className="space-y-2">
                {[...todayTasks].sort((a,b) => b.createdAt - a.createdAt).map(task => (
                  <TaskItem key={task.id} task={task} field="today" />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between sticky top-0 bg-slate-50 py-1 z-10">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-brand-50 text-brand-600 rounded-md"><Calendar size={14} /></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">To Do Tomorrow</span>
                </div>
                <button 
                  onClick={() => setAddingTo(addingTo === 'tomorrow' ? null : 'tomorrow')}
                  className={`p-1 rounded-md transition-colors ${addingTo === 'tomorrow' ? 'bg-slate-200 text-slate-600' : 'text-brand-500 hover:bg-brand-50'}`}
                >
                  {addingTo === 'tomorrow' ? <X size={16} /> : <Plus size={16} />}
                </button>
              </div>
              {addingTo === 'tomorrow' && (
                <input 
                  autoFocus
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask('tomorrow')}
                  placeholder="What for tomorrow?"
                  className="w-full bg-white border border-brand-200 rounded-xl px-3 py-2 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}
              <div className="space-y-2">
                {[...tomorrowTasks].sort((a,b) => b.createdAt - a.createdAt).map(task => (
                  <TaskItem key={task.id} task={task} field="tomorrow" />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between sticky top-0 bg-slate-50 py-1 z-10">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-slate-100 text-slate-600 rounded-md"><Clock size={14} /></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">To Do Later</span>
                </div>
                <button 
                  onClick={() => setAddingTo(addingTo === 'later' ? null : 'later')}
                  className={`p-1 rounded-md transition-colors ${addingTo === 'later' ? 'bg-slate-200 text-slate-600' : 'text-slate-400 hover:bg-slate-100'}`}
                >
                  {addingTo === 'later' ? <X size={16} /> : <Plus size={16} />}
                </button>
              </div>
              {addingTo === 'later' && (
                <input 
                  autoFocus
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask('later')}
                  placeholder="Future tasks..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-slate-500"
                />
              )}
              <div className="space-y-2">
                {[...laterTasks].sort((a,b) => b.createdAt - a.createdAt).map(task => (
                  <TaskItem key={task.id} task={task} field="later" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Engagements</span>
                  <p className="text-[9px] text-slate-300 font-bold uppercase mt-0.5">Drag to prioritize</p>
               </div>
               <button 
                onClick={() => setAddingTo(addingTo === 'project' ? null : 'project')}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-brand-100 hover:bg-brand-600 transition-all"
               >
                 <Plus size={14} /> Start New Project
               </button>
            </div>

            {addingTo === 'project' && (
              <div className="p-4 bg-white border border-brand-200 rounded-2xl mb-4 animate-in slide-in-from-top-2">
                <div className="flex gap-3 mb-2">
                  <div className="flex-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Title</label>
                    <input 
                      autoFocus
                      type="text"
                      value={newProjectTitle}
                      onChange={(e) => setNewProjectTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addProject()}
                      placeholder="Project Title..."
                      className="w-full text-sm font-bold outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                   <button onClick={() => setAddingTo(null)} className="text-[10px] font-bold text-slate-400 uppercase">Cancel</button>
                   <button onClick={addProject} className="text-[10px] font-black text-brand-600 uppercase">Create Project</button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={projects.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {projects.map(project => (
                      <SortableProject 
                        key={project.id}
                        project={project}
                        isExpanded={expandedProjectId === project.id}
                        onToggle={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
                        onDelete={() => deleteProject(project)}
                        onUpdateTitle={(title) => updateProjectTitle(project, title)}
                        onUpdateDescription={(desc) => updateProjectDescription(project, desc)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {projects.length === 0 && !addingTo && (
                <div className="text-center py-12 px-6 border-2 border-dashed border-slate-200 rounded-3xl">
                   <Briefcase size={32} className="mx-auto text-slate-200 mb-3" />
                   <p className="text-sm font-bold text-slate-400">No ongoing projects yet.</p>
                   <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-1">Start one to track long-term goals</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

