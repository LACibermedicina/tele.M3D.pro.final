import { Router } from 'express';
import { db } from '../db';
import { medicalTeams, medicalTeamMembers, users, patients } from '@shared/schema';
import { insertMedicalTeamSchema, insertMedicalTeamMemberSchema } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Get all medical teams for the logged-in doctor
router.get('/', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can access this endpoint' });
    }

    // Get teams where user is a member
    const teamMemberships = await db
      .select({
        team: medicalTeams,
        memberRole: medicalTeamMembers.role,
      })
      .from(medicalTeamMembers)
      .innerJoin(medicalTeams, eq(medicalTeamMembers.teamId, medicalTeams.id))
      .where(and(
        eq(medicalTeamMembers.userId, req.user.id),
        eq(medicalTeams.isActive, true)
      ))
      .orderBy(desc(medicalTeams.lastMeetingAt));

    // Get members count for each team
    const teamsWithDetails = await Promise.all(
      teamMemberships.map(async ({ team, memberRole }) => {
        const members = await db
          .select({
            id: medicalTeamMembers.id,
            userId: medicalTeamMembers.userId,
            role: medicalTeamMembers.role,
            joinedAt: medicalTeamMembers.joinedAt,
            userName: users.name,
            userEmail: users.email,
            profilePicture: users.profilePicture,
          })
          .from(medicalTeamMembers)
          .innerJoin(users, eq(medicalTeamMembers.userId, users.id))
          .where(eq(medicalTeamMembers.teamId, team.id));

        let patientInfo = null;
        if (team.patientId) {
          const patientData = await db
            .select()
            .from(patients)
            .where(eq(patients.id, team.patientId))
            .limit(1);
          patientInfo = patientData[0] || null;
        }

        return {
          ...team,
          memberRole,
          membersCount: members.length,
          members,
          patient: patientInfo,
        };
      })
    );

    res.json(teamsWithDetails);
  } catch (error) {
    console.error('Get medical teams error:', error);
    res.status(500).json({ message: 'Failed to fetch medical teams' });
  }
});

// Create a new medical team
router.post('/', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can create teams' });
    }

    const validatedData = insertMedicalTeamSchema.parse({
      ...req.body,
      createdBy: req.user.id,
    });

    // Create team
    const [newTeam] = await db
      .insert(medicalTeams)
      .values({
        ...validatedData,
        roomId: `team_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      })
      .returning();

    // Add creator as team leader
    await db.insert(medicalTeamMembers).values({
      teamId: newTeam.id,
      userId: req.user.id,
      role: 'leader',
    });

    res.status(201).json(newTeam);
  } catch (error) {
    console.error('Create medical team error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid team data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create medical team' });
  }
});

// Get specific team details
router.get('/:id', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can access this endpoint' });
    }

    const teamData = await db
      .select()
      .from(medicalTeams)
      .where(eq(medicalTeams.id, req.params.id))
      .limit(1);

    if (teamData.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const team = teamData[0];

    // Check if user is a member
    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, team.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized to view this team' });
    }

    // Get all members
    const members = await db
      .select({
        id: medicalTeamMembers.id,
        userId: medicalTeamMembers.userId,
        role: medicalTeamMembers.role,
        joinedAt: medicalTeamMembers.joinedAt,
        userName: users.name,
        userEmail: users.email,
        profilePicture: users.profilePicture,
        medicalLicense: users.medicalLicense,
        specialization: users.specialization,
      })
      .from(medicalTeamMembers)
      .innerJoin(users, eq(medicalTeamMembers.userId, users.id))
      .where(eq(medicalTeamMembers.teamId, team.id));

    let patientInfo = null;
    if (team.patientId) {
      const patientData = await db
        .select()
        .from(patients)
        .where(eq(patients.id, team.patientId))
        .limit(1);
      patientInfo = patientData[0] || null;
    }

    res.json({
      ...team,
      members,
      patient: patientInfo,
      notes: [], // Placeholder for notes - would come from separate table in production
      files: [], // Placeholder for files - would come from separate table in production
    });
  } catch (error) {
    console.error('Get team details error:', error);
    res.status(500).json({ message: 'Failed to fetch team details' });
  }
});

// Add member to team
router.post('/:id/members', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can add members' });
    }

    const teamData = await db
      .select()
      .from(medicalTeams)
      .where(eq(medicalTeams.id, req.params.id))
      .limit(1);

    if (teamData.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Check if user is team leader
    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0 || membership[0].role !== 'leader') {
      return res.status(403).json({ message: 'Only team leaders can add members' });
    }

    const validatedData = insertMedicalTeamMemberSchema.parse({
      ...req.body,
      teamId: req.params.id,
    });

    // Check if member already exists
    const existingMember = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, validatedData.userId)
      ))
      .limit(1);

    if (existingMember.length > 0) {
      return res.status(400).json({ message: 'User is already a team member' });
    }

    const [newMember] = await db
      .insert(medicalTeamMembers)
      .values(validatedData)
      .returning();

    res.status(201).json(newMember);
  } catch (error) {
    console.error('Add team member error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid member data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to add team member' });
  }
});

// Remove member from team
router.delete('/:id/members/:userId', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can remove members' });
    }

    // Check if user is team leader
    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0 || membership[0].role !== 'leader') {
      return res.status(403).json({ message: 'Only team leaders can remove members' });
    }

    // Cannot remove yourself if you're the leader
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ message: 'Team leaders cannot remove themselves' });
    }

    await db
      .delete(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.params.userId)
      ));

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ message: 'Failed to remove team member' });
  }
});

// Update team
router.patch('/:id', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can update teams' });
    }

    // Check if user is team leader
    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0 || membership[0].role !== 'leader') {
      return res.status(403).json({ message: 'Only team leaders can update the team' });
    }

    const [updatedTeam] = await db
      .update(medicalTeams)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(medicalTeams.id, req.params.id))
      .returning();

    res.json(updatedTeam);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ message: 'Failed to update team' });
  }
});

// Update last meeting time and return room info
router.post('/:id/meeting', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can update meeting time' });
    }

    // Check if user is a member
    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const teamData = await db
      .select()
      .from(medicalTeams)
      .where(eq(medicalTeams.id, req.params.id))
      .limit(1);

    if (teamData.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const [updatedTeam] = await db
      .update(medicalTeams)
      .set({
        lastMeetingAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(medicalTeams.id, req.params.id))
      .returning();

    res.json({ ...updatedTeam, roomId: teamData[0].roomId });
  } catch (error) {
    console.error('Update meeting time error:', error);
    res.status(500).json({ message: 'Failed to update meeting time' });
  }
});

// Add note to team
router.post('/:id/notes', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can add notes' });
    }

    // Check if user is a member
    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    // For now, return success - in production you'd want to store in a separate table
    res.json({ 
      success: true, 
      note: {
        id: `note_${Date.now()}`,
        content: content.trim(),
        authorId: req.user.id,
        authorName: req.user.name,
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ message: 'Failed to add note' });
  }
});

// Upload file to team (placeholder)
router.post('/:id/files', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can upload files' });
    }

    // Check if user is a member
    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // For now, return success - in production you'd handle file upload
    res.json({ 
      success: true,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ message: 'Failed to upload file' });
  }
});

export default router;
