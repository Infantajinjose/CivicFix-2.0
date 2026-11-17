import 'dotenv/config';
import { connectDB } from './config/db.js';
import Tenant from './models/Tenant.js';
import User from './models/User.js';
import Issue from './models/Issue.js';
import SLAConfiguration from './models/SLAConfiguration.js';
import Subscription from './models/Subscription.js';
import QRLocation from './models/QRLocation.js';
import Notification from './models/Notification.js';
import Feedback from './models/Feedback.js';
import { createQrLocationSpot } from './services/qrService.js';
import { PLANS } from './services/billingService.js';

await connectDB();

console.log('Seeding CivicFix 2.0 Enterprise SaaS demo data...');

// 1. Create or Find Demo Tenant
let tenant = await Tenant.findOne({ slug: 'civicfix-demo' });
if (!tenant) {
  tenant = await Tenant.create({
    name: 'CivicFix Metropolis Community',
    slug: 'civicfix-demo',
    plan: 'professional',
    status: 'active',
    departments: ['Sanitation', 'Water & Sewage', 'Roads & Infrastructure', 'Streetlights', 'Drainage', 'Electrical', 'Civil Maintenance', 'General Services'],
    publicDashboard: {
      enabled: true,
      title: 'Metropolis Public Civic Dashboard',
      description: 'Transparent community service resolution records & live performance metrics.',
      showRecentResolved: true,
      showMap: true
    }
  });
}

// 2. Ensure SLA Configuration
let sla = await SLAConfiguration.findOne({ tenantId: tenant._id });
if (!sla) {
  sla = await SLAConfiguration.create({
    tenantId: tenant._id,
    rules: [
      { category: 'All', priority: 'urgent', resolutionHours: 4, warningHours: 1 },
      { category: 'All', priority: 'high', resolutionHours: 24, warningHours: 4 },
      { category: 'All', priority: 'medium', resolutionHours: 72, warningHours: 12 },
      { category: 'All', priority: 'low', resolutionHours: 168, warningHours: 24 }
    ]
  });
}

// 3. Ensure Professional Subscription
let sub = await Subscription.findOne({ tenantId: tenant._id });
if (!sub) {
  sub = await Subscription.create({
    tenantId: tenant._id,
    plan: 'professional',
    status: 'active',
    limits: PLANS.professional.limits
  });
  tenant.subscription = sub._id;
  await tenant.save();
}

// Helper to get or create user
async function getOrCreateUser(data) {
  let user = await User.findOne({ email: data.email });
  if (!user) user = await User.create({ tenantId: tenant._id, ...data });
  return user;
}

// 4. Create All Required Demo Role Accounts
const superadmin = await User.findOne({ email: 'superadmin@civicfix.com' });
if (!superadmin) {
  await User.create({
    name: 'Platform Super Administrator',
    email: 'superadmin@civicfix.com',
    password: 'CivicFix@123',
    role: 'superadmin',
    department: 'Platform Governance'
  });
}

const owner = await getOrCreateUser({
  name: 'Rajesh Mehta',
  email: 'owner@civicfix.demo',
  password: 'CivicFix@123',
  role: 'owner',
  department: 'Administration',
  phone: '+91 98765 43210'
});

const manager = await getOrCreateUser({
  name: 'Sunita Rao',
  email: 'manager@civicfix.demo',
  password: 'CivicFix@123',
  role: 'manager',
  department: 'Sanitation',
  phone: '+91 98765 43211'
});

const worker = await getOrCreateUser({
  name: 'Arun Kumar',
  email: 'worker@civicfix.demo',
  password: 'CivicFix@123',
  role: 'worker',
  department: 'Sanitation',
  phone: '+91 98765 43212'
});

const resident = await getOrCreateUser({
  name: 'Priya Sharma',
  email: 'resident@civicfix.demo',
  password: 'CivicFix@123',
  role: 'resident',
  department: 'Block C Resident',
  phone: '+91 98765 43213'
});

// 5. Create Sample Facility QR Code Spots
const existingQr = await QRLocation.countDocuments({ tenantId: tenant._id });
if (!existingQr) {
  await createQrLocationSpot({
    tenantId: tenant._id,
    label: 'Block A - Ground Floor Restroom',
    department: 'Sanitation',
    category: 'Sanitation',
    address: 'Block A, Ground Floor, Near Reception',
    lat: 13.0835,
    lng: 80.2710,
    userId: owner._id
  });

  await createQrLocationSpot({
    tenantId: tenant._id,
    label: 'Community Centre - Main Water Cooler',
    department: 'Water & Sewage',
    category: 'Water',
    address: 'Community Center, 1st Floor Foyer',
    lat: 13.0825,
    lng: 80.2718,
    userId: owner._id
  });

  await createQrLocationSpot({
    tenantId: tenant._id,
    label: 'North Gate Waste Disposal Station',
    department: 'Sanitation',
    category: 'Garbage',
    address: 'Opposite North Parking Lot',
    lat: 13.0815,
    lng: 80.2695,
    userId: owner._id
  });
}

// 6. Create Realistic Sample Complaints with AI Analysis & SLA Status
const count = await Issue.countDocuments({ tenantId: tenant._id });
if (count < 5) {
  const now = Date.now();
  const samples = [
    {
      ticketNumber: 'CF-2026-1001',
      title: 'Main access streetlight flickering and sparking near Gate 2',
      description: 'The overhead streetlight pole at Gate 2 is flickering erratically and sparking occasionally during dusk. Potential electrical hazard for passing pedestrians.',
      category: 'Streetlights',
      priority: 'urgent',
      status: 'assigned',
      subStatus: 'assigned',
      department: 'Electrical',
      createdBy: resident._id,
      assignedTo: worker._id,
      dueAt: new Date(now + 3 * 3600 * 1000),
      sla: { deadline: new Date(now + 3 * 3600 * 1000), warningAt: new Date(now + 1 * 3600 * 1000), isEscalated: false },
      location: { address: 'Pedestrian Walkway, Gate 2', lat: 13.0827, lng: 80.2707 },
      aiAnalysis: {
        suggestedCategory: 'Streetlights',
        suggestedPriority: 'urgent',
        suggestedDepartment: 'Electrical',
        summary: 'Streetlight flickering with sparks near Gate 2 walkway',
        confidence: 0.94,
        isDuplicate: false
      },
      history: [
        { status: 'submitted', note: 'Issue reported by resident with photos', changedBy: resident._id },
        { status: 'assigned', note: 'Assigned to Arun Kumar by Sunita Rao', changedBy: manager._id }
      ]
    },
    {
      ticketNumber: 'CF-2026-1002',
      title: 'Heavy drinking water pipe burst flooding Block B driveway',
      description: 'The municipal supply pipe beside Block B entrance has ruptured. Clean water is gushing across the road and flooding the basement ramp.',
      category: 'Water',
      priority: 'urgent',
      status: 'in_progress',
      subStatus: 'in_progress',
      department: 'Water & Sewage',
      createdBy: resident._id,
      assignedTo: worker._id,
      dueAt: new Date(now + 4 * 3600 * 1000),
      sla: { deadline: new Date(now + 4 * 3600 * 1000), warningAt: new Date(now + 2 * 3600 * 1000), isEscalated: false },
      location: { address: 'Block B Entrance & Driveway', lat: 13.0840, lng: 80.2720 },
      workerResponse: { acceptedAt: new Date(now - 30 * 60 * 1000), startedAt: new Date(now - 15 * 60 * 1000) },
      aiAnalysis: {
        suggestedCategory: 'Water',
        suggestedPriority: 'urgent',
        suggestedDepartment: 'Water & Sewage',
        summary: 'Pipe rupture causing basement ramp flooding at Block B',
        confidence: 0.96,
        isDuplicate: false
      },
      history: [
        { status: 'submitted', note: 'Reported with GPS coordinates', changedBy: resident._id },
        { status: 'assigned', note: 'Dispatched to water maintenance unit', changedBy: manager._id },
        { status: 'in_progress', note: 'Worker arrived on site with repair clamp', changedBy: worker._id }
      ]
    },
    {
      ticketNumber: 'CF-2026-1003',
      title: 'Waste bins overflowing in visitor parking zone',
      description: 'Commercial bins in the South visitor parking zone are completely overflowing with refuse and food waste attracting stray animals.',
      category: 'Garbage',
      priority: 'medium',
      status: 'resolved',
      subStatus: 'verified',
      department: 'Sanitation',
      createdBy: resident._id,
      assignedTo: worker._id,
      dueAt: new Date(now - 2 * 3600 * 1000),
      resolutionNote: 'Commercial compactors dispatched; waste cleared, disinfected and new bins installed.',
      sla: { resolvedWithinSla: true, actualResolutionHours: 14 },
      verification: { verifiedBy: manager._id, verifiedAt: new Date(), notes: 'Inspected and verified clean.' },
      location: { address: 'South Visitor Parking, Bay 4', lat: 13.0818, lng: 80.2698 },
      aiAnalysis: {
        suggestedCategory: 'Garbage',
        suggestedPriority: 'medium',
        suggestedDepartment: 'Sanitation',
        summary: 'Overflowing commercial refuse bins in visitor parking',
        confidence: 0.91,
        isDuplicate: false
      },
      history: [
        { status: 'submitted', note: 'Issue logged via QR code', changedBy: resident._id },
        { status: 'assigned', note: 'Assigned to Arun Kumar', changedBy: manager._id },
        { status: 'in_progress', note: 'Sanitation team arrived', changedBy: worker._id },
        { status: 'resolved', note: 'Compactor cleared all bins. Disinfection completed.', changedBy: manager._id }
      ]
    },
    {
      ticketNumber: 'CF-2026-1004',
      title: 'Deep pothole causing vehicular damage near West Exit road',
      description: 'A 2-foot wide pothole on the asphalt surface near the West Exit road is creating an acute road hazard. Vehicles are scraping bottom plates.',
      category: 'Roads',
      priority: 'high',
      status: 'submitted',
      subStatus: 'submitted',
      department: 'Roads & Infrastructure',
      createdBy: resident._id,
      dueAt: new Date(now + 20 * 3600 * 1000),
      sla: { deadline: new Date(now + 20 * 3600 * 1000), warningAt: new Date(now + 16 * 3600 * 1000), isEscalated: false },
      location: { address: 'West Exit Road near Milestone 3', lat: 13.0832, lng: 80.2689 },
      aiAnalysis: {
        suggestedCategory: 'Roads',
        suggestedPriority: 'high',
        suggestedDepartment: 'Roads & Infrastructure',
        summary: 'Hazardous pothole causing vehicle damage on West Exit',
        confidence: 0.89,
        isDuplicate: false
      },
      history: [{ status: 'submitted', note: 'Issue logged with photo evidence', changedBy: resident._id }]
    },
    {
      ticketNumber: 'CF-2026-1005',
      title: 'Blocked storm drain causing foul smell and stagnant puddle',
      description: 'Leaves and debris have completely choked the drainage grill outside Block C. Dirty puddle is accumulating on the pavement.',
      category: 'Drainage',
      priority: 'medium',
      status: 'assigned',
      subStatus: 'accepted',
      department: 'Water & Sewage',
      createdBy: resident._id,
      assignedTo: worker._id,
      dueAt: new Date(now + 48 * 3600 * 1000),
      sla: { deadline: new Date(now + 48 * 3600 * 1000), warningAt: new Date(now + 36 * 3600 * 1000), isEscalated: false },
      location: { address: 'Block C Pavement Entrance', lat: 13.0845, lng: 80.2715 },
      workerResponse: { acceptedAt: new Date(now - 1 * 3600 * 1000) },
      aiAnalysis: {
        suggestedCategory: 'Drainage',
        suggestedPriority: 'medium',
        suggestedDepartment: 'Water & Sewage',
        summary: 'Choked storm drain causing standing water near Block C',
        confidence: 0.93,
        isDuplicate: false
      },
      history: [
        { status: 'submitted', note: 'Logged by resident', changedBy: resident._id },
        { status: 'assigned', note: 'Assigned to Arun Kumar', changedBy: manager._id }
      ]
    }
  ];

  const createdIssues = await Issue.insertMany(samples.map(item => ({ ...item, tenantId: tenant._id })));

  // Add resident feedback to the resolved issue
  const resolvedIssue = createdIssues.find(i => i.status === 'resolved');
  if (resolvedIssue) {
    const feedback = await Feedback.create({
      tenantId: tenant._id,
      issueId: resolvedIssue._id,
      userId: resident._id,
      rating: 5,
      comment: 'Very fast resolution! Waste was cleared in under 2 hours and area was deodorized.',
      isResolved: true,
      department: 'Sanitation',
      category: 'Garbage'
    });
    resolvedIssue.feedback = feedback._id;
    await resolvedIssue.save();
  }

  // Add sample notification for owner & worker
  await Notification.create({
    tenantId: tenant._id,
    recipient: owner._id,
    type: 'ISSUE_CREATED',
    title: 'New Urgent Issue Reported: CF-2026-1001',
    message: 'Priya Sharma reported "Main access streetlight flickering and sparking near Gate 2"',
    issueId: createdIssues[0]._id
  });

  await Notification.create({
    tenantId: tenant._id,
    recipient: worker._id,
    type: 'ISSUE_ASSIGNED',
    title: 'New Task Assignment: CF-2026-1002',
    message: 'You have been assigned to "Heavy drinking water pipe burst flooding Block B driveway"',
    issueId: createdIssues[1]._id
  });
}

console.log('\n======================================================');
console.log('✅ CivicFix 2.0 Enterprise SaaS Demo Data Ready!');
console.log('======================================================');
console.log('Role               Email                      Password');
console.log('------------------------------------------------------');
console.log('Super Admin:       superadmin@civicfix.com    CivicFix@123');
console.log('Organisation Owner: owner@civicfix.demo        CivicFix@123');
console.log('Dept Manager:      manager@civicfix.demo      CivicFix@123');
console.log('Field Worker:      worker@civicfix.demo       CivicFix@123');
console.log('Resident:          resident@civicfix.demo     CivicFix@123');
console.log('======================================================\n');

process.exit(0);
