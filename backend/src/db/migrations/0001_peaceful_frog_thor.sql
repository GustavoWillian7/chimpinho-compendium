CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"color" text,
	"position" text DEFAULT '0' NOT NULL,
	"archived_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nodes_user_id_idx" ON "nodes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nodes_parent_id_idx" ON "nodes" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "nodes_path_idx" ON "nodes" USING btree ("path");--> statement-breakpoint
CREATE INDEX "nodes_position_idx" ON "nodes" USING btree ("user_id","parent_id","position");