export const MOCK_TASKS = [
  {
    id: "task-1",
    title: "Profile Section UI Fix",
    projectName: "EMS Modernization",
    assignedTo: "Harshada",
    assignedBy: "John Doe",
    deadline: "2026-05-10",
    priority: "High",
    description: "Create a responsive sidebar with modern icons and smooth transitions.",
    status: "In Progress",
    progress: 38,
    createdAt: "2026-04-25",
    subtaskGroups: [
      {
        id: "group-1",
        title: "Header Section",
        items: [
          { id: "st-1", title: "Fix logo alignment", tag: "Bug", isCompleted: true, assignee: "John Doe", date: "07 May" },
          { id: "st-2", title: "Add notification icon", tag: "Bug", isCompleted: true, assignee: "Harshada", date: "07 May" },
          { id: "st-3", title: "Resolve header responsiveness", tag: "Blocker", isCompleted: false, assignee: "Harshada", date: "08 May" },
        ]
      },
      {
        id: "group-2",
        title: "Experience Card",
        items: [
          { id: "st-4", title: "Update layout", tag: "Task", isCompleted: false, assignee: "Harshada", date: "09 May" },
        ]
      },
      {
        id: "group-3",
        title: "Posts Cards",
        items: [
          { id: "st-5", title: "Fix image aspect ratio", tag: "Bug", isCompleted: false, assignee: "John Doe", date: "10 May" },
        ]
      }
    ],
    activity: [
      { id: "act-1", user: "John Doe", action: "Assigned task to Harshada", date: "2026-05-01 10:00 AM" },
      { id: "act-2", user: "Harshada", action: "Completed: Fix logo alignment", date: "2026-05-07 02:30 PM" },
    ]
  },
  {
    id: "task-2",
    title: "Login Flow Enhancement",
    projectName: "Security Audit",
    assignedTo: "John Doe",
    assignedBy: "Super Admin",
    deadline: "2026-05-15",
    priority: "Medium",
    description: "Enhance the security of the login flow with MFA and better error handling.",
    status: "In Progress",
    progress: 33,
    createdAt: "2026-04-27",
    subtaskGroups: [
      {
        id: "group-1",
        title: "Security Logic",
        items: [
          { id: "st-6", title: "Implement MFA", tag: "Critical", isCompleted: false, assignee: "John Doe", date: "12 May" },
          { id: "st-7", title: "Audit session storage", tag: "Task", isCompleted: true, assignee: "John Doe", date: "10 May" },
        ]
      }
    ],
    activity: []
  },
  {
    id: "task-3",
    title: "Employee Dashboard Design",
    projectName: "EMS Modernization",
    assignedTo: "John Doe",
    assignedBy: "HR Manager",
    deadline: "2026-05-18",
    priority: "Low",
    description: "Design a modern dashboard for employees to track their tasks and attendance.",
    status: "In Progress",
    progress: 40,
    createdAt: "2026-04-30",
    subtaskGroups: [
      {
        id: "group-1",
        title: "UI Design",
        items: [
          { id: "st-8", title: "Create layout mockups", tag: "Task", isCompleted: true, assignee: "John Doe", date: "12 May" },
          { id: "st-9", title: "Review with stakeholders", tag: "Meeting", isCompleted: false, assignee: "John Doe", date: "15 May" },
        ]
      }
    ],
    activity: []
  },
  {
    id: "task-4",
    title: "Leave Module Bugs",
    projectName: "HR Operations",
    assignedTo: "John Doe",
    assignedBy: "Jane Smith",
    deadline: "2026-05-12",
    priority: "High",
    description: "Fix reported bugs in the leave management module.",
    status: "Pending",
    progress: 20,
    createdAt: "2026-05-01",
    subtaskGroups: [
      {
        id: "group-1",
        title: "Bug Fixing",
        items: [
          { id: "st-10", title: "Fix date selection", tag: "Bug", isCompleted: true, assignee: "John Doe", date: "05 May" },
          { id: "st-11", title: "Correct leave balance calculation", tag: "Bug", isCompleted: false, assignee: "John Doe", date: "08 May" },
        ]
      }
    ],
    activity: []
  },
  {
    id: "task-5",
    title: "API Integration - Attendance",
    projectName: "Reporting Module",
    assignedTo: "John Doe",
    assignedBy: "Tech Lead",
    deadline: "2026-05-20",
    priority: "Medium",
    description: "Integrate the attendance API with the frontend dashboard.",
    status: "In Progress",
    progress: 43,
    createdAt: "2026-05-05",
    subtaskGroups: [],
    activity: []
  },
  {
    id: "task-6",
    title: "Mobile Responsive Fixes",
    projectName: "Internal Tools",
    assignedTo: "John Doe",
    assignedBy: "Design Lead",
    deadline: "2026-05-22",
    priority: "Low",
    description: "Fix layout issues on mobile devices for the internal portal.",
    status: "In Progress",
    progress: 25,
    createdAt: "2026-05-06",
    subtaskGroups: [],
    activity: []
  },
  {
    id: "task-7",
    title: "Permission Management",
    projectName: "Security Audit",
    assignedTo: "Jane Smith",
    assignedBy: "Admin",
    deadline: "2026-05-25",
    priority: "Medium",
    description: "Implement role-based access control for all modules.",
    status: "In Progress",
    progress: 56,
    createdAt: "2026-05-07",
    subtaskGroups: [],
    activity: []
  },
  {
    id: "task-8",
    title: "Reports & Analytics",
    projectName: "Reporting Module",
    assignedTo: "John Doe",
    assignedBy: "Manager",
    deadline: "2026-05-30",
    priority: "Low",
    description: "Build a comprehensive reporting and analytics engine.",
    status: "Pending",
    progress: 17,
    createdAt: "2026-05-08",
    subtaskGroups: [],
    activity: []
  }
];

export const MOCK_PROJECTS = ["EMS Modernization", "Security Audit", "Reporting Module", "HR Operations", "Internal Tools"];
export const MOCK_EMPLOYEES = [
  { id: "1", full_name: "John Doe", department: "Engineering" },
  { id: "2", full_name: "Harshada", department: "Design" },
  { id: "3", full_name: "Jane Smith", department: "HR" },
  { id: "4", full_name: "Robert Wilson", department: "Management" },
];
