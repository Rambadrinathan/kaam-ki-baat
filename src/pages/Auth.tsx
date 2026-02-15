import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Briefcase, Phone, User } from 'lucide-react';
import { Language, languageNames, getTranslation } from '@/utils/i18n';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const { signIn, signUp } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const t = getTranslation(language);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithPhone(phone);
  };

  const loginWithPhone = async (phoneNumber: string) => {
    setIsLoading(true);
    
    const { error } = await signIn(phoneNumber, phoneNumber);
    
    if (error) {
      toast({
        title: t.loginFailed,
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: t.welcomeBack,
        description: t.successfullyLoggedIn
      });
      navigate('/');
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: t.nameRequired,
        description: t.pleaseEnterName,
        variant: 'destructive'
      });
      return;
    }

    if (phone.length !== 10) {
      toast({
        title: t.invalidPhone,
        description: t.enterTenDigit,
        variant: 'destructive'
      });
      return;
    }
    
    setIsLoading(true);
    
    const result = await signUp(phone, phone, name);
    
    if (result.error) {
      toast({
        title: t.signUpFailed,
        description: result.error.message,
        variant: 'destructive'
      });
    } else {
      // Show notification if auto-joined to groups
      if (result.groupsJoined && result.groupsJoined > 0) {
        toast({
          title: t.welcome,
          description: t.addedToGroups
        });
      } else {
        toast({
          title: t.accountCreated,
          description: t.welcomeToApp
        });
      }
      navigate('/');
    }
    
    setIsLoading(false);
  };

  const languages: Language[] = ['en', 'hi', 'bn'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Language Toggle */}
        <div className="flex justify-center gap-3">
          {languages.map((lang) => (
            <Button
              key={lang}
              variant={language === lang ? 'default' : 'outline'}
              size="lg"
              onClick={() => setLanguage(lang)}
              className="min-w-[56px] min-h-[48px] text-base"
            >
              {languageNames[lang]}
            </Button>
          ))}
        </div>

        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-28 w-28 rounded-2xl bg-primary flex items-center justify-center">
              <Briefcase className="h-14 w-14 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground">{t.appName}</h1>
          <p className="text-xl text-muted-foreground font-medium">{t.appTagline}</p>
        </div>

        <Card>
          <Tabs defaultValue="signin" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t.signIn}</TabsTrigger>
                <TabsTrigger value="signup">{t.signUp}</TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="signin-phone" className="text-base">{t.mobileNumber}</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                      <Input
                        id="signin-phone"
                        type="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                        className="h-14 pl-12 text-lg"
                        maxLength={10}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{t.passwordHint}</p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-lg font-bold"
                    disabled={isLoading || phone.length !== 10}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                        {t.signingIn}
                      </>
                    ) : (
                      t.signIn
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="signup-name" className="text-base">{t.name}</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder={t.yourName}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-14 text-lg"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="signup-phone" className="text-base">{t.mobileNumber}</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                        className="h-14 pl-14 text-lg"
                        maxLength={10}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{t.passwordHintSignup}</p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-lg font-bold"
                    disabled={isLoading || phone.length !== 10}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                        {t.creatingAccount}
                      </>
                    ) : (
                      t.createAccount
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-sm text-center text-muted-foreground">
          {t.anyoneCanCreateTeam}
        </p>
      </div>
    </div>
  );
}
