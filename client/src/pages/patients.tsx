import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPatientSchema, type Patient } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { z } from "zod";
import { formatErrorForToast } from "@/lib/error-handler";
import { MessageCircle, Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { useTranslation } from "react-i18next";

const patientFormSchema = insertPatientSchema.extend({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
});

type PatientFormData = z.infer<typeof patientFormSchema>;

export default function Patients() {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isWhatsAppInviteOpen, setIsWhatsAppInviteOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [inviteDate, setInviteDate] = useState("");
  const [inviteTime, setInviteTime] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: patients, isLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  });

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      gender: "",
      bloodType: "",
      allergies: "",
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: (data: PatientFormData) => apiRequest('POST', '/api/patients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      toast({
        title: t("common.success"),
        description: t("patients_page.registered_success"),
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    },
  });

  const updatePatientMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: PatientFormData }) => apiRequest('PUT', `/api/patients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      toast({
        title: t("common.success"),
        description: t("patients_page.updated_success"),
      });
      setIsEditDialogOpen(false);
      setEditingPatient(null);
      editForm.reset();
    },
    onError: (error) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    },
  });

  const deletePatientMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/patients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      toast({
        title: t("common.success"),
        description: t("common.remove") + " - " + t("common.success").toLowerCase(),
      });
    },
    onError: (error) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    },
  });

  const editForm = useForm<PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      gender: "",
      bloodType: "",
      allergies: "",
    },
  });

  const onSubmit = (data: PatientFormData) => {
    createPatientMutation.mutate(data);
  };

  const onEditSubmit = (data: PatientFormData) => {
    if (editingPatient) {
      updatePatientMutation.mutate({ id: editingPatient.id, data });
    }
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient);
    editForm.reset({
      name: patient.name,
      email: patient.email || "",
      phone: patient.phone,
      gender: patient.gender || "",
      bloodType: patient.bloodType || "",
      allergies: patient.allergies || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeletePatient = (patient: Patient) => {
    if (confirm(`${t("common.confirm")} - ${patient.name}?`)) {
      deletePatientMutation.mutate(patient.id);
    }
  };

  const sendWhatsAppInviteMutation = useMutation({
    mutationFn: (data: { patientId: string; date: string; time: string; message?: string }) => 
      apiRequest('POST', '/api/whatsapp/invite-consultation', data),
    onSuccess: () => {
      toast({
        title: t("common.send") + "!",
        description: t("patients_page.whatsapp_invite_sent"),
      });
      setIsWhatsAppInviteOpen(false);
      setSelectedPatient(null);
      setInviteDate("");
      setInviteTime("");
      setInviteMessage("");
    },
    onError: (error) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    },
  });

  const handleWhatsAppInvite = (patient: Patient) => {
    setSelectedPatient(patient);
    // Set default message
    setInviteMessage(`Olá ${patient.name}! Gostaria de agendar uma consulta com você. Por favor, confirme sua disponibilidade para a data sugerida.`);
    setIsWhatsAppInviteOpen(true);
  };

  const handleSendInvite = () => {
    if (!selectedPatient || !inviteDate || !inviteTime) {
      toast({
        title: t("common.required_field"),
        description: t("common.date") + " / " + t("common.time"),
        variant: "destructive",
      });
      return;
    }

    sendWhatsAppInviteMutation.mutate({
      patientId: selectedPatient.id,
      date: inviteDate,
      time: inviteTime,
      message: inviteMessage,
    });
  };

  const filteredPatients = (patients || []).filter((patient: Patient) =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("patients_page.title")}</h1>
          <p className="text-muted-foreground">{t("patients.title")}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-medical-primary" data-testid="button-new-patient">
              <i className="fas fa-plus mr-2"></i>
              {t("patients_page.new_patient")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("patients_page.new_patient")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ui.full_name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("ui.fullname_placeholder")} {...field} value={field.value || ""} data-testid="input-patient-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.phone")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("ui.phone_placeholder")} {...field} data-testid="input-patient-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.email")}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t("ui.email_placeholder")} {...field} value={field.value || ""} data-testid="input-patient-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("patients_page.gender")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("patients_page.select_gender")} {...field} value={field.value || ""} data-testid="input-patient-gender" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bloodType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("patients_page.blood_type")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("patients_page.select_blood_type")} {...field} value={field.value || ""} data-testid="input-patient-blood-type" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients_page.allergies")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("patients_page.allergies")} {...field} value={field.value || ""} data-testid="input-patient-allergies" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-patient"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createPatientMutation.isPending}
                    data-testid="button-save-patient"
                  >
                    {createPatientMutation.isPending ? t("common.loading") : t("common.save")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Patient Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("common.edit")} {t("common.patient")}</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ui.full_name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("ui.fullname_placeholder")} {...field} value={field.value || ""} data-testid="input-edit-patient-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.phone")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("ui.phone_placeholder")} {...field} data-testid="input-edit-patient-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.email")}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t("ui.email_placeholder")} {...field} value={field.value || ""} data-testid="input-edit-patient-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("patients_page.gender")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("patients_page.select_gender")} {...field} value={field.value || ""} data-testid="input-edit-patient-gender" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="bloodType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("patients_page.blood_type")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("patients_page.select_blood_type")} {...field} value={field.value || ""} data-testid="input-edit-patient-blood-type" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients_page.allergies")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("patients_page.allergies")} {...field} value={field.value || ""} data-testid="input-edit-patient-allergies" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingPatient(null);
                    }}
                    data-testid="button-cancel-edit-patient"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updatePatientMutation.isPending}
                    data-testid="button-save-edit-patient"
                  >
                    {updatePatientMutation.isPending ? t("common.loading") : t("common.save")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <Input
          placeholder={t("patients_page.search_patients")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
          data-testid="input-search-patients"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <i className="fas fa-users text-6xl text-muted-foreground mb-4"></i>
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">{t("patients_page.no_patients")}</h3>
            <p className="text-muted-foreground">
              {searchTerm ? t("common.no_results") : t("patients_page.no_patients")}
            </p>
          </div>
        ) : (
          filteredPatients.map((patient: any) => (
            <Card key={patient.id} className="patient-card" data-testid={`card-patient-${patient.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(210, 85%, 95%)' }}>
                      <i className="fas fa-user text-lg" style={{ color: 'var(--medical-primary)' }}></i>
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-patient-name-${patient.id}`}>{patient.name}</CardTitle>
                      <p className="text-sm text-muted-foreground" data-testid={`text-patient-phone-${patient.id}`}>{patient.phone}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleWhatsAppInvite(patient)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    title={t("patients_page.whatsapp_invite") || "WhatsApp"}
                    data-testid={`button-whatsapp-invite-${patient.id}`}
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {patient.email && (
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-envelope text-muted-foreground"></i>
                      <span data-testid={`text-patient-email-${patient.id}`}>{patient.email}</span>
                    </div>
                  )}
                  {patient.gender && (
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-venus-mars text-muted-foreground"></i>
                      <span data-testid={`text-patient-gender-${patient.id}`}>{patient.gender}</span>
                    </div>
                  )}
                  {patient.bloodType && (
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-tint text-muted-foreground"></i>
                      <span data-testid={`text-patient-blood-type-${patient.id}`}>{patient.bloodType}</span>
                    </div>
                  )}
                  {patient.allergies && (
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-exclamation-triangle text-destructive"></i>
                      <span className="text-destructive" data-testid={`text-patient-allergies-${patient.id}`}>{patient.allergies}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setLocation(`/patients/${patient.id}`)}
                    data-testid={`button-view-patient-${patient.id}`}
                  >
                    <i className="fas fa-eye mr-2"></i>
                    {t("common.details")}
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => setLocation(`/records?patientId=${patient.id}`)}
                    data-testid={`button-records-patient-${patient.id}`}
                  >
                    <i className="fas fa-file-medical mr-2"></i>
                    {t("navigation.records")}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEditPatient(patient)}
                    data-testid={`button-edit-patient-${patient.id}`}
                  >
                    <i className="fas fa-edit mr-2"></i>
                    {t("common.edit")}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeletePatient(patient)}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-delete-patient-${patient.id}`}
                  >
                    <i className="fas fa-trash mr-2"></i>
                    {t("common.remove")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* WhatsApp Invite Dialog */}
      <Dialog open={isWhatsAppInviteOpen} onOpenChange={setIsWhatsAppInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              {t("patients_page.whatsapp_invite") || "WhatsApp"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPatient && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">{t("common.patient")}: {selectedPatient.name}</p>
                <p className="text-xs text-muted-foreground">{selectedPatient.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-date">{t("common.date")}</Label>
                  <div className="relative">
                    <Input
                      id="invite-date"
                      type="date"
                      value={inviteDate}
                      onChange={(e) => setInviteDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      data-testid="input-invite-date"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-time">{t("common.time")}</Label>
                  <Input
                    id="invite-time"
                    type="time"
                    value={inviteTime}
                    onChange={(e) => setInviteTime(e.target.value)}
                    data-testid="input-invite-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-message">{t("common.description")}</Label>
                <Textarea
                  id="invite-message"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder={t("common.notes")}
                  rows={4}
                  data-testid="textarea-invite-message"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <p className="text-xs text-green-700 dark:text-green-400">
                  {t("patients_page.whatsapp_auto_send") || "WhatsApp"}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsWhatsAppInviteOpen(false);
                    setSelectedPatient(null);
                  }}
                  data-testid="button-cancel-invite"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleSendInvite}
                  disabled={sendWhatsAppInviteMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-send-invite"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {sendWhatsAppInviteMutation.isPending ? t("common.loading") : t("common.send")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </PageWrapper>
  );
}
