CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"type" text DEFAULT 'note' NOT NULL,
	"title" text NOT NULL,
	"content" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"position" text DEFAULT '0' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "items_type_check" CHECK ("items"."type" in ('note'))
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_user_id_idx" ON "items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "items_node_id_idx" ON "items" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "items_position_idx" ON "items" USING btree ("user_id","node_id","position");