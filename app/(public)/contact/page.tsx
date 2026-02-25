import { Card, CardContent } from "@/components/ui/card";
import {
  Phone,
  Mail,
  MessageCircle,
  Clock,
  MapPin,
  MessageSquare,
  Globe,
} from "lucide-react";

export default function ContactPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" data-testid="heading-contact">
            Contact Us
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            At RideCheck, we&apos;re here to help before, during, and after your inspection. If you have questions about an order, pricing, scheduling, or a vehicle you&apos;re considering — reach out anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card data-testid="card-phone">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Phone Support</h3>
                  <p className="text-xs text-muted-foreground mb-2">English &amp; Spanish Available</p>
                  <p className="text-lg font-bold">(312) 429-XXXX</p>
                  <p className="text-sm text-muted-foreground mt-1">8 AM – 8 PM CST, 7 days a week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-whatsapp">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-green-500/10 p-2.5">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">WhatsApp Support</h3>
                  <p className="text-sm text-muted-foreground mb-3">Quick questions? Chat instantly on WhatsApp.</p>
                  <a
                    href="https://wa.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:underline"
                    data-testid="link-whatsapp"
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-live-chat">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-blue-500/10 p-2.5">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Live Chat Support</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Start a conversation directly on the website. Our team responds within minutes during business hours.
                  </p>
                  <p className="text-sm text-muted-foreground">Available 8 AM – 10 PM CST</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-email">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Email</h3>
                  <p className="text-sm text-muted-foreground mb-2">For detailed questions or follow-ups</p>
                  <a
                    href="mailto:support@ridecheckauto.com"
                    className="text-primary font-medium hover:underline"
                    data-testid="link-email"
                  >
                    support@ridecheckauto.com
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">Response time: 2–6 hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card data-testid="card-service-cities">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Service Cities</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>Lake County</li>
                <li>Chicago Metro</li>
                <li className="text-primary text-xs font-medium">More cities coming soon!</li>
              </ul>
            </CardContent>
          </Card>

          <Card data-testid="card-hours">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Business Hours</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li><span className="font-medium text-foreground">Phone:</span> 8 AM – 8 PM CST, Daily</li>
                <li><span className="font-medium text-foreground">Chat:</span> 8 AM – 10 PM CST, Daily</li>
                <li><span className="font-medium text-foreground">Email:</span> 24/7 (2-6 hour response)</li>
              </ul>
            </CardContent>
          </Card>

          <Card data-testid="card-address">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Mailing Address</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                RideCheck<br />
                33 N County St<br />
                Waukegan, IL 60085<br />
                USA
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
